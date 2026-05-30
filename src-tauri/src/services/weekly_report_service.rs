//! 週次 Deep Research レポートサービス (v1.1 Phase H)
//!
//! 過去7日間のインタラクション（open / bookmark / deepdive）が多いトピック TOP3 を選定し、
//! web 検索を使って深掘り調査を行い、`digests` テーブルに category='weekly_report' として保存する。
//! 生成・保存・capability 判定は [`web_report_service`] に委譲し、ここでは対象トピック選定と
//! 週次固有のプロンプト組み立てに専念する。
//!
//! web 検索非対応 LLM / 未設定の場合はスキップ（エラーにしない）。
use crate::error::AppError;
use crate::infra::llm_client::LlmClient;
use crate::services::web_report_service::{self, ReportOutcome, WebReportSpec};
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
/// web 検索非対応 LLM / 未設定の場合は早期にスキップする (トピック取得の無駄を省く)。
pub async fn generate_weekly_report(
    db: &SqlitePool,
    llm: Option<&dyn LlmClient>,
) -> Result<WeeklyReportResult, AppError> {
    // capability チェック (重い topic 取得の前に判定)
    if let Some(reason) = web_report_service::skip_reason(llm) {
        warn!("{reason}");
        return Ok(WeeklyReportResult {
            reports_generated: 0,
            skipped_reason: Some(reason),
        });
    }

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
        info!(article_id, title, interaction_count, "週次レポート生成中");

        let spec = WebReportSpec {
            category: "weekly_report",
            title: format!("週刊レポート: {}", web_report_service::truncate(title, 40)),
            system_prompt: "あなたはアニメ・マンガ・ゲーム業界の調査アナリストです。\
                ユーザーが関心を持つトピックについて、最新情報を網羅した詳細レポートを日本語で作成してください。\
                レポートは「## 概要」「## 最新動向」「## 今後の展望」の3セクション構成にしてください。"
                .to_string(),
            user_prompt: format!(
                "以下のトピックについて、最新の動向と詳細情報を調査してください。\n\nトピック: {title}"
            ),
            article_ids: article_id.to_string(),
            max_tokens: 1500,
            include_citations: false,
        };

        match web_report_service::generate_web_report(db, llm, spec).await {
            Ok(ReportOutcome::Saved(digest)) => {
                info!(digest_id = digest.id, title, "週次レポート保存完了");
                reports_generated += 1;
            }
            Ok(ReportOutcome::Skipped(reason)) => {
                warn!(title, reason, "週次レポートスキップ");
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn fetch_top_topics_empty_db() {
        use crate::infra::database;
        use std::path::PathBuf;
        let db = database::init_pool(&PathBuf::from(":memory:"))
            .await
            .unwrap();
        let topics = fetch_top_topics(&db).await.unwrap();
        assert!(topics.is_empty());
    }

    #[tokio::test]
    async fn generate_weekly_report_skips_without_llm() {
        use crate::infra::database;
        use std::path::PathBuf;
        let db = database::init_pool(&PathBuf::from(":memory:"))
            .await
            .unwrap();
        let result = generate_weekly_report(&db, None).await.unwrap();
        assert_eq!(result.reports_generated, 0);
        assert!(result.skipped_reason.is_some());
    }
}
