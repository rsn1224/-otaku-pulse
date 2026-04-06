/// 週次 Deep Research レポートサービス (v1.1 Phase H)
///
/// 過去7日間のインタラクション（open / bookmark / deepdive）が多いトピック TOP3 を選定し、
/// Perplexity web_search を使って深掘り調査を行い、`digests` テーブルに
/// category='weekly_report' として保存する。
///
/// Perplexity API Key が未設定の場合はスキップ（エラーにしない）。
use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmProvider, LlmRequest};
use crate::models::Digest;
use crate::services::digest_queries;
use sqlx::SqlitePool;
use tracing::{info, warn};

/// 週次レポート生成の結果
#[derive(Debug)]
pub struct WeeklyReportResult {
    /// 生成したレポート数
    pub reports_generated: usize,
    /// スキップされた場合の理由
    pub skipped_reason: Option<String>,
}

/// 週次レポートを生成して `digests` テーブルに保存する。
///
/// `llm` が None または Ollama プロバイダーの場合は Perplexity web_search が使えないためスキップ。
pub async fn generate_weekly_report(
    db: &SqlitePool,
    llm: Option<&dyn LlmClient>,
) -> Result<WeeklyReportResult, AppError> {
    // Perplexity のみサポート（web_search が必要なため）
    let llm_client = match llm {
        Some(c) if matches!(c.provider(), LlmProvider::PerplexitySonar) => c,
        Some(_) => {
            let reason = "週次レポートには Perplexity API Key が必要です（現在 Ollama が選択中）".to_string();
            warn!("{}", reason);
            return Ok(WeeklyReportResult {
                reports_generated: 0,
                skipped_reason: Some(reason),
            });
        }
        None => {
            let reason = "LLM が未設定のため週次レポートをスキップします".to_string();
            warn!("{}", reason);
            return Ok(WeeklyReportResult {
                reports_generated: 0,
                skipped_reason: Some(reason),
            });
        }
    };

    // 過去7日間のインタラクションが多いトピック TOP3 を取得
    let top_topics = fetch_top_topics(db).await?;

    if top_topics.is_empty() {
        info!("週次レポート: 対象トピックなし（インタラクション記録なし）");
        return Ok(WeeklyReportResult {
            reports_generated: 0,
            skipped_reason: Some("対象トピックがありません".to_string()),
        });
    }

    let mut reports_generated = 0;

    for (article_id, title, interaction_count) in &top_topics {
        info!(
            article_id,
            title,
            interaction_count,
            "週次レポート生成中"
        );

        match generate_single_report(db, llm_client, *article_id, title).await {
            Ok(digest_id) => {
                info!(digest_id, title, "週次レポート保存完了");
                reports_generated += 1;
            }
            Err(e) => {
                warn!(title, error = %e, "週次レポート生成失敗、スキップして続行");
            }
        }
    }

    info!(reports_generated, "週次レポート生成完了");
    Ok(WeeklyReportResult {
        reports_generated,
        skipped_reason: None,
    })
}

/// 過去7日間の閲覧数が多い記事タイトル TOP3 を取得する。
/// 戻り値: (article_id, title, interaction_count)
async fn fetch_top_topics(db: &SqlitePool) -> Result<Vec<(i64, String, i64)>, AppError> {
    let rows: Vec<(i64, String, i64)> = sqlx::query_as(
        "SELECT a.id, a.title, COUNT(ai.id) AS cnt
         FROM article_interactions ai
         JOIN articles a ON a.id = ai.article_id
         WHERE ai.action IN ('open', 'bookmark', 'deepdive')
           AND ai.created_at >= datetime('now', '-7 days')
           AND a.is_duplicate = 0
         GROUP BY a.id
         ORDER BY cnt DESC
         LIMIT 3",
    )
    .fetch_all(db)
    .await?;

    Ok(rows)
}

/// 1件のトピックについて Deep Research レポートを生成し、DB に保存する。
async fn generate_single_report(
    db: &SqlitePool,
    llm: &dyn LlmClient,
    article_id: i64,
    title: &str,
) -> Result<i64, AppError> {
    let system_prompt =
        "あなたはアニメ・マンガ・ゲーム業界の調査アナリストです。\
        ユーザーが関心を持つトピックについて、最新情報を網羅した詳細レポートを日本語で作成してください。\
        レポートは「## 概要」「## 最新動向」「## 今後の展望」の3セクション構成にしてください。"
            .to_string();

    let user_prompt = format!(
        "以下のトピックについて、最新の動向と詳細情報を調査してください。\n\nトピック: {title}"
    );

    let request = LlmRequest {
        system_prompt,
        user_prompt,
        max_tokens: 1500,
        web_search: true,
        conversation: None,
    };

    let response = llm.complete(request).await?;

    let report_title = format!("週刊レポート: {}", truncate(title, 40));
    let now = chrono::Utc::now().to_rfc3339();

    let digest = Digest {
        id: 0, // DB が自動採番
        category: "weekly_report".to_string(),
        title: report_title,
        content_markdown: response.content.clone(),
        content_html: None,
        article_ids: article_id.to_string(),
        model_used: Some(response.model),
        token_count: None,
        generated_at: now,
    };

    let digest_id = digest_queries::insert_digest(db, &digest).await?;
    Ok(digest_id)
}

/// 文字列を最大 `max_chars` 文字に切り詰める。
fn truncate(s: &str, max_chars: usize) -> String {
    let mut chars = s.chars();
    let truncated: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        format!("{truncated}…")
    } else {
        truncated
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_short_string() {
        assert_eq!(truncate("hello", 10), "hello");
    }

    #[test]
    fn truncate_long_string() {
        let result = truncate("あいうえおかきくけこさしすせそたちつてと", 10);
        assert!(result.ends_with('…'));
        assert!(result.chars().count() <= 11); // 10文字 + "…"
    }

    #[tokio::test]
    async fn fetch_top_topics_empty_db() {
        use crate::infra::database;
        use std::path::PathBuf;
        let db = database::init_pool(&PathBuf::from(":memory:")).await.unwrap();
        let topics = fetch_top_topics(&db).await.unwrap();
        assert!(topics.is_empty());
    }

    #[tokio::test]
    async fn generate_weekly_report_skips_without_llm() {
        use crate::infra::database;
        use std::path::PathBuf;
        let db = database::init_pool(&PathBuf::from(":memory:")).await.unwrap();
        let result = generate_weekly_report(&db, None).await.unwrap();
        assert_eq!(result.reports_generated, 0);
        assert!(result.skipped_reason.is_some());
    }
}
