//! 調査レポート生成サービス (機能C)
//!
//! 任意クエリを受け取り、web 検索 (出典付き多源調査) で citations 付きの Markdown レポートを
//! `digests` テーブル (category='research_report') に保存する。
//! 生成・保存・出典整形・capability 判定は [`web_report_service`] に委譲し、ここでは
//! クエリ検証と research 固有のプロンプト組み立てに専念する。

use crate::error::AppError;
use crate::infra::llm_client::LlmClient;
use crate::models::Digest;
use crate::services::web_report_service::{self, ReportOutcome, WebReportSpec};
use sqlx::SqlitePool;

/// 調査レポート生成の結果。
pub struct ResearchReportResult {
    /// 生成・保存されたダイジェスト (id 設定済み)。skip 時は None。
    pub digest: Option<Digest>,
    /// skip された場合の理由。
    pub skipped_reason: Option<String>,
}

/// 任意クエリの調査レポートを生成し `digests` に保存する。
pub async fn generate_research_report(
    db: &SqlitePool,
    llm: Option<&dyn LlmClient>,
    query: &str,
) -> Result<ResearchReportResult, AppError> {
    let query = query.trim();
    if query.is_empty() {
        return Err(AppError::InvalidInput("調査クエリが空です".to_string()));
    }

    let system_prompt = "あなたは多分野を扱うリサーチアナリストです。\
        ユーザーが指定したトピックについて、ウェブ検索で最新情報を裏取りしながら、\
        中立的で出典に基づいた詳細レポートを日本語で作成してください。\
        構成は「## 概要」「## 詳細」「## 留意点・今後の展望」の3セクションとし、\
        推測と事実を明確に区別してください。"
        .to_string();

    let user_prompt = format!(
        "次のトピックを多角的に調査し、最新の動向を踏まえてレポートを作成してください。\n\nトピック: {query}"
    );

    let spec = WebReportSpec {
        category: "research_report",
        title: format!("調査レポート: {}", web_report_service::truncate(query, 40)),
        system_prompt,
        user_prompt,
        article_ids: String::new(),
        max_tokens: 2000,
        include_citations: true,
    };

    match web_report_service::generate_web_report(db, llm, spec).await? {
        ReportOutcome::Saved(digest) => Ok(ResearchReportResult {
            digest: Some(digest),
            skipped_reason: None,
        }),
        ReportOutcome::Skipped(reason) => Ok(ResearchReportResult {
            digest: None,
            skipped_reason: Some(reason),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::database;
    use std::path::PathBuf;

    #[tokio::test]
    async fn rejects_empty_query() {
        let db = database::init_pool(&PathBuf::from(":memory:"))
            .await
            .unwrap();
        let result = generate_research_report(&db, None, "   ").await;
        assert!(matches!(result, Err(AppError::InvalidInput(_))));
    }

    #[tokio::test]
    async fn skips_without_llm() {
        let db = database::init_pool(&PathBuf::from(":memory:"))
            .await
            .unwrap();
        let result = generate_research_report(&db, None, "Rust async")
            .await
            .unwrap();
        assert!(result.digest.is_none());
        assert!(result.skipped_reason.is_some());
    }
}
