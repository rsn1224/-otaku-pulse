/// Today View サービス (v1.1, ADR-103)
///
/// 過去24時間のスコア上位10記事から LLM で3点要約を生成し、
/// `today_view` テーブルにキャッシュする。
/// キャッシュ有効期間: 3時間。
use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest};
use crate::models::TodayViewItem;
use sqlx::SqlitePool;
use tracing::{info, warn};

const CACHE_TTL_HOURS: i64 = 3;
const TOP_ARTICLES_LIMIT: i64 = 10;

/// Today View を取得する（キャッシュが有効な場合はキャッシュを返す）。
/// LLM が未設定の場合はスコア上位3件のタイトルをフォールバックとして返す。
pub async fn get_today_view(
    db: &SqlitePool,
    llm: Option<&dyn LlmClient>,
) -> Result<Vec<TodayViewItem>, AppError> {
    // キャッシュ確認
    let cached = get_cached(db).await?;
    if !cached.is_empty() {
        return Ok(cached);
    }

    // 再生成
    generate_today_view(db, llm).await
}

async fn get_cached(db: &SqlitePool) -> Result<Vec<TodayViewItem>, AppError> {
    let rows: Vec<(i64, String, i64, String)> = sqlx::query_as(
        "SELECT article_id, headline, rank, generated_at
         FROM today_view
         WHERE generated_at >= datetime('now', ?)
         ORDER BY rank ASC",
    )
    .bind(format!("-{CACHE_TTL_HOURS} hours"))
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(article_id, headline, rank, generated_at)| TodayViewItem {
            article_id,
            headline,
            rank,
            generated_at,
        })
        .collect())
}

async fn generate_today_view(
    db: &SqlitePool,
    llm: Option<&dyn LlmClient>,
) -> Result<Vec<TodayViewItem>, AppError> {
    // 過去24時間のスコア上位記事を取得
    let articles: Vec<(i64, String)> = sqlx::query_as(
        "SELECT a.id, a.title
         FROM articles a
         LEFT JOIN article_scores s ON a.id = s.article_id
         WHERE a.is_duplicate = 0
           AND a.published_at >= datetime('now', '-24 hours')
         ORDER BY COALESCE(s.total_score, a.importance_score) DESC
         LIMIT ?",
    )
    .bind(TOP_ARTICLES_LIMIT)
    .fetch_all(db)
    .await?;

    if articles.is_empty() {
        return Ok(Vec::new());
    }

    let items = if let Some(llm_client) = llm {
        generate_with_llm(llm_client, &articles).await.unwrap_or_else(|e| {
            warn!(error = %e, "Today View LLM generation failed, using fallback");
            fallback_items(&articles)
        })
    } else {
        fallback_items(&articles)
    };

    // today_view テーブルに保存（既存を削除して全件上書き）
    sqlx::query("DELETE FROM today_view").execute(db).await?;

    for item in &items {
        sqlx::query(
            "INSERT INTO today_view (article_id, headline, rank, generated_at)
             VALUES (?1, ?2, ?3, datetime('now'))",
        )
        .bind(item.article_id)
        .bind(&item.headline)
        .bind(item.rank)
        .execute(db)
        .await?;
    }

    info!(count = items.len(), "Today View 生成完了");
    Ok(items)
}

async fn generate_with_llm(
    llm: &dyn LlmClient,
    articles: &[(i64, String)],
) -> Result<Vec<TodayViewItem>, AppError> {
    let titles_list = articles
        .iter()
        .enumerate()
        .map(|(i, (_, title))| format!("{}. {}", i + 1, title))
        .collect::<Vec<_>>()
        .join("\n");

    let system_prompt =
        "あなたはアニメ・マンガ・ゲームニュースのキュレーターです。".to_string();
    let user_prompt = format!(
        "以下の記事タイトルから、今日最も重要な3件を選び、\
        それぞれ「タイトルが要点」の形式で20文字以内の見出しを作ってください。\
        出力は以下のJSON形式で返してください（配列の先頭から重要度順）:\
        [{{\"rank\": 1, \"article_index\": <元のリスト番号>, \"headline\": \"見出し\"}}, ...]\n\n\
        記事一覧:\n{titles_list}"
    );

    let request = LlmRequest::simple(system_prompt, user_prompt, 300);
    let response = llm.complete(request).await?;

    parse_llm_response(&response.content, articles)
}

fn parse_llm_response(
    content: &str,
    articles: &[(i64, String)],
) -> Result<Vec<TodayViewItem>, AppError> {
    // JSON 配列を抽出（```json ... ``` ブロックにも対応）
    let json_str = if let Some(start) = content.find('[') {
        let end = content.rfind(']').unwrap_or(content.len() - 1);
        &content[start..=end]
    } else {
        return Ok(fallback_items(articles));
    };

    #[derive(serde::Deserialize)]
    struct LlmItem {
        rank: i64,
        article_index: usize,
        headline: String,
    }

    let parsed: Vec<LlmItem> = serde_json::from_str(json_str)
        .map_err(|e| AppError::Parse(format!("Today View LLM response parse error: {e}")))?;

    let items: Vec<TodayViewItem> = parsed
        .into_iter()
        .take(3)
        .filter_map(|item| {
            // article_index は 1-based
            let idx = item.article_index.saturating_sub(1);
            articles.get(idx).map(|(article_id, _)| TodayViewItem {
                article_id: *article_id,
                headline: item.headline,
                rank: item.rank,
                generated_at: chrono::Utc::now().to_rfc3339(),
            })
        })
        .collect();

    if items.is_empty() {
        Ok(fallback_items(articles))
    } else {
        Ok(items)
    }
}

fn fallback_items(articles: &[(i64, String)]) -> Vec<TodayViewItem> {
    articles
        .iter()
        .take(3)
        .enumerate()
        .map(|(i, (article_id, title))| TodayViewItem {
            article_id: *article_id,
            // タイトル先頭30文字をフォールバック見出しに
            headline: title.chars().take(30).collect(),
            rank: (i + 1) as i64,
            generated_at: chrono::Utc::now().to_rfc3339(),
        })
        .collect()
}
