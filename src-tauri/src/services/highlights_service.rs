use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest};
use crate::models::DiscoverArticleDto;
use sqlx::SqlitePool;

use super::highlights_helpers::parse_numbered_lines;
pub use super::highlights_helpers::{HighlightEntry, TrendKeyword, get_trending_keywords};

/// daily_highlights キャッシュの有効期間 (分)。収集間隔 (既定 60min) に合わせる。
const CACHE_TTL_MINUTES: i64 = 60;

/// ハイライト記事の取得列 (DiscoverArticleDto に対応)。
const HIGHLIGHT_COLS: &str = "a.id, a.feed_id, a.title, a.url, a.summary, a.author, \
     a.published_at, a.is_read, a.is_bookmarked, a.language, \
     a.thumbnail_url, a.ai_summary, a.impact_level, \
     f.name AS feed_name, f.category AS category";

/// キャッシュ行 (DiscoverArticleDto をフラット展開 + reason)。
#[derive(sqlx::FromRow)]
struct CachedHighlightRow {
    #[sqlx(flatten)]
    article: DiscoverArticleDto,
    reason: String,
}

/// 日次ハイライトを取得する (P1-1)。
/// 有効な daily_highlights キャッシュがあれば LLM を呼ばずに即返す。
/// 無ければ生成してキャッシュへ書き込む。`llm` が None なら fallback 理由で生成する。
pub async fn get_daily_highlights(
    db: &SqlitePool,
    llm: Option<&dyn LlmClient>,
) -> Result<Vec<HighlightEntry>, AppError> {
    let cached = read_cached(db).await?;
    if !cached.is_empty() {
        return Ok(cached);
    }
    generate_and_store(db, llm).await
}

/// キャッシュを無視して再生成・保存する (scheduler の収集後事前計算用)。
pub async fn refresh_highlights(
    db: &SqlitePool,
    llm: Option<&dyn LlmClient>,
) -> Result<Vec<HighlightEntry>, AppError> {
    generate_and_store(db, llm).await
}

/// 有効期間内の daily_highlights をハイドレートして返す。無効/空なら空 Vec。
async fn read_cached(db: &SqlitePool) -> Result<Vec<HighlightEntry>, AppError> {
    let sql = format!(
        "SELECT {HIGHLIGHT_COLS}, \
                COALESCE(s.total_score, a.importance_score) AS total_score, dh.reason AS reason \
         FROM daily_highlights dh \
         JOIN articles a ON a.id = dh.article_id \
         JOIN feeds f ON a.feed_id = f.id \
         LEFT JOIN article_scores s ON a.id = s.article_id \
         WHERE dh.generated_at >= datetime('now', ?1) \
         ORDER BY dh.rank ASC"
    );
    let rows = sqlx::query_as::<_, CachedHighlightRow>(&sql)
        .bind(format!("-{CACHE_TTL_MINUTES} minutes"))
        .fetch_all(db)
        .await?;

    Ok(rows
        .into_iter()
        .map(|r| HighlightEntry {
            article: r.article,
            reason: r.reason,
        })
        .collect())
}

/// 過去24h 上位5件を選び、LLM (or fallback) で理由を付与してキャッシュへ保存する。
async fn generate_and_store(
    db: &SqlitePool,
    llm: Option<&dyn LlmClient>,
) -> Result<Vec<HighlightEntry>, AppError> {
    let sql = format!(
        "SELECT {HIGHLIGHT_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score \
         FROM articles a JOIN feeds f ON a.feed_id = f.id \
         LEFT JOIN article_scores s ON a.id = s.article_id \
         WHERE a.is_duplicate = 0 AND a.published_at >= datetime('now', '-24 hours') \
         ORDER BY COALESCE(s.total_score, a.importance_score) DESC LIMIT 5"
    );
    let articles = sqlx::query_as::<_, DiscoverArticleDto>(&sql)
        .fetch_all(db)
        .await?;

    if articles.is_empty() {
        // 期限切れの古いキャッシュは消しておく
        sqlx::query("DELETE FROM daily_highlights")
            .execute(db)
            .await?;
        return Ok(vec![]);
    }

    let reasons = generate_reasons(llm, &articles).await;

    // 全件上書き (today_view と同方式)
    sqlx::query("DELETE FROM daily_highlights")
        .execute(db)
        .await?;
    for (i, (article, reason)) in articles.iter().zip(&reasons).enumerate() {
        sqlx::query(
            "INSERT INTO daily_highlights (article_id, reason, rank, generated_at) \
             VALUES (?1, ?2, ?3, datetime('now'))",
        )
        .bind(article.id)
        .bind(reason)
        .bind((i + 1) as i64)
        .execute(db)
        .await?;
    }

    let highlights = articles
        .into_iter()
        .zip(reasons)
        .map(|(article, reason)| HighlightEntry { article, reason })
        .collect();

    Ok(highlights)
}

/// LLM で各記事の注目理由を生成する。None / 失敗時はタイトルベースの fallback。
async fn generate_reasons(
    llm: Option<&dyn LlmClient>,
    articles: &[DiscoverArticleDto],
) -> Vec<String> {
    let Some(llm) = llm else {
        return vec!["注目".to_string(); articles.len()];
    };

    let title_list = articles
        .iter()
        .enumerate()
        .map(|(i, a)| format!("{}. {}", i + 1, a.title))
        .collect::<Vec<_>>()
        .join("\n");

    let n = articles.len();
    // 構造化出力 (Ollama format): reasons 配列を入力順に返させる。脆い番号行パースを排除。
    let schema = serde_json::json!({
        "type": "object",
        "properties": {
            "reasons": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["reasons"]
    });
    let req = LlmRequest::structured(
        "あなたはオタクニュースのキュレーターです。\
            各記事について「なぜ注目すべきか」を15文字以内で作り、入力と同じ順番で返してください。"
            .to_string(),
        format!(
            "次の {n} 件それぞれの注目理由を {n} 個、JSON {{\"reasons\": [...]}} で返してください:\n{title_list}"
        ),
        200,
        schema,
    );

    match llm.complete(req).await {
        Ok(r) => parse_reasons(&r.content, n),
        Err(e) => {
            tracing::warn!(error = %e, "LLM highlight generation failed, using fallback");
            vec!["注目".to_string(); n]
        }
    }
}

/// 構造化出力 `{"reasons": [...]}` をパースして n 件に揃える。
/// JSON でない場合 (非対応 provider) は番号行パースに、それも失敗なら "注目" で埋める。
fn parse_reasons(content: &str, n: usize) -> Vec<String> {
    #[derive(serde::Deserialize)]
    struct Reasons {
        reasons: Vec<String>,
    }

    if let Ok(parsed) = serde_json::from_str::<Reasons>(content.trim()) {
        let mut v = parsed.reasons;
        v.truncate(n);
        while v.len() < n {
            v.push("注目".to_string());
        }
        return v;
    }

    // フォールバック: 番号付き行 (構造化非対応 provider 向け)
    parse_numbered_lines(content, n)
}

pub async fn batch_generate_summaries(
    db: &SqlitePool,
    llm: &dyn LlmClient,
    limit: i64,
) -> Result<u32, AppError> {
    let rows: Vec<(i64, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT a.id, a.title, a.summary, a.content
         FROM articles a
         LEFT JOIN article_scores s ON a.id = s.article_id
         WHERE a.is_duplicate = 0
           AND a.ai_summary IS NULL
           AND a.published_at >= datetime('now', '-48 hours')
         ORDER BY COALESCE(s.total_score, a.importance_score) DESC
         LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(db)
    .await?;

    let mut generated = 0u32;

    for (id, title, summary, content) in &rows {
        let source_text = content.as_deref().or(summary.as_deref()).unwrap_or("");

        if source_text.is_empty() {
            continue;
        }

        let req = LlmRequest::simple(
            "与えられたテキストだけを使って日本語で2文の要約を書いてください。\
                外部検索は使わないこと。謝罪や注釈は書かないこと。"
                .to_string(),
            format!(
                "タイトル: {}\n\n本文: {}",
                title,
                &source_text[..source_text.len().min(1200)]
            ),
            150,
        );

        match llm.complete(req).await {
            Ok(response) => {
                let ai_summary = response.content.trim().to_string();
                if let Err(e) = sqlx::query(
                    "UPDATE articles SET ai_summary = ?1, ai_summary_generated_at = datetime('now')
                     WHERE id = ?2",
                )
                .bind(&ai_summary)
                .bind(id)
                .execute(db)
                .await
                {
                    tracing::warn!(article_id = id, error = %e, "ai_summary DB update failed");
                }
                generated += 1;
            }
            Err(e) => {
                tracing::warn!(article_id = id, error = %e, "Batch summary generation failed");
                break; // LLM エラーなら残りもスキップ
            }
        }
    }

    tracing::info!(count = generated, "Batch summary generation completed");
    Ok(generated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::llm_client::{LlmProvider, LlmResponse};
    use crate::services::test_helpers::setup_test_db;

    struct StubLlm;

    #[async_trait::async_trait]
    impl LlmClient for StubLlm {
        async fn complete(&self, _req: LlmRequest) -> Result<LlmResponse, AppError> {
            Ok(LlmResponse {
                content: "1. 注目その1\n2. 注目その2".to_string(),
                provider: LlmProvider::Ollama,
                model: "stub".to_string(),
                citations: vec![],
            })
        }
        fn provider(&self) -> LlmProvider {
            LlmProvider::Ollama
        }
    }

    /// Regression: get_daily_highlights selects every DiscoverArticleDto column
    /// (notably impact_level). A missing column makes sqlx FromRow fail with
    /// "no column found for name: impact_level" at decode time.
    #[tokio::test]
    async fn get_daily_highlights_decodes_dto_including_impact_level() {
        let db = setup_test_db().await;

        sqlx::query(
            "INSERT INTO feeds (id, name, url, feed_type, category, created_at, updated_at)
             VALUES (1, 'test', 'http://test', 'rss', 'anime', datetime('now'), datetime('now'))",
        )
        .execute(&db)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO articles (id, feed_id, title, published_at, importance_score, created_at)
             VALUES (1, 1, 'Recent article', datetime('now'), 5.0, datetime('now'))",
        )
        .execute(&db)
        .await
        .unwrap();

        let highlights = get_daily_highlights(&db, Some(&StubLlm))
            .await
            .expect("highlights query must decode DiscoverArticleDto without ColumnNotFound");

        assert_eq!(highlights.len(), 1);
        assert_eq!(
            highlights[0].article.impact_level.as_deref(),
            Some("general")
        );
    }
}
