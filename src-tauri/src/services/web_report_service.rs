//! Web レポート生成の共通基盤 (機能C / 週次レポート共有)
//!
//! `weekly_report_service` と `research_report_service` が共有していた
//! 「capability チェック → graceful skip → web_search complete → 出典整形 → digests 保存」を
//! 1 箇所に集約する。プロバイダ具象 (`PerplexitySonar`) を直接判定せず、
//! `LlmClient::supports_web_search()` の capability で分岐する。

use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest};
use crate::models::Digest;
use crate::services::digest_queries;
use sqlx::SqlitePool;
use tracing::{info, warn};

/// 1 件の web レポート生成指示。
pub struct WebReportSpec {
    /// `digests.category` ("weekly_report" | "research_report")。
    pub category: &'static str,
    /// レポートタイトル。
    pub title: String,
    pub system_prompt: String,
    pub user_prompt: String,
    /// 関連記事 ID (CSV)。research は空文字。
    pub article_ids: String,
    pub max_tokens: u32,
    /// 出典リスト (`## 出典`) を本文末尾に付与するか。
    pub include_citations: bool,
}

/// web レポート生成の結果。
pub enum ReportOutcome {
    /// 生成・保存に成功 (id 設定済み)。
    Saved(Digest),
    /// web 検索非対応 / LLM 未設定でスキップ (理由付き)。
    Skipped(String),
}

/// web 検索が使えない場合のスキップ理由を返す。使える場合は `None`。
/// 重い前処理 (トピック取得等) の前に早期判定するため公開する。
pub fn skip_reason(llm: Option<&dyn LlmClient>) -> Option<String> {
    match llm {
        Some(c) if c.supports_web_search() => None,
        Some(_) => {
            Some("web 検索対応の LLM (Perplexity) が必要です（現在 Ollama が選択中）".to_string())
        }
        None => Some("LLM が未設定のため web 検索レポートをスキップします".to_string()),
    }
}

/// spec に従って web レポートを 1 件生成し `digests` に保存する。
/// web 検索非対応 LLM / 未設定なら `Skipped` を返す (エラーにしない)。
pub async fn generate_web_report(
    db: &SqlitePool,
    llm: Option<&dyn LlmClient>,
    spec: WebReportSpec,
) -> Result<ReportOutcome, AppError> {
    let llm = match llm {
        Some(c) if c.supports_web_search() => c,
        other => {
            let reason = skip_reason(other).unwrap_or_else(|| "web 検索非対応".to_string());
            warn!("{reason}");
            return Ok(ReportOutcome::Skipped(reason));
        }
    };

    let request = LlmRequest {
        system_prompt: spec.system_prompt,
        user_prompt: spec.user_prompt,
        max_tokens: spec.max_tokens,
        web_search: true,
        conversation: None,
        format: None,
    };

    let response = llm.complete(request).await?;

    let mut markdown = response.content;
    if spec.include_citations && !response.citations.is_empty() {
        markdown.push_str("\n\n## 出典\n");
        for (i, c) in response.citations.iter().enumerate() {
            let label = c.title.as_deref().unwrap_or(&c.url);
            markdown.push_str(&format!("{}. [{}]({})\n", i + 1, label, c.url));
        }
    }

    let digest = Digest {
        id: 0,
        category: spec.category.to_string(),
        title: spec.title,
        content_markdown: markdown,
        content_html: None,
        article_ids: spec.article_ids,
        model_used: Some(response.model),
        token_count: None,
        generated_at: chrono::Utc::now().to_rfc3339(),
    };

    let id = digest_queries::insert_digest(db, &digest).await?;
    info!(
        digest_id = id,
        category = spec.category,
        "web レポート保存完了"
    );

    Ok(ReportOutcome::Saved(Digest { id, ..digest }))
}

/// 文字列を最大 `max_chars` 文字に切り詰める (UTF-8 安全)。レポートタイトル生成で共有。
pub fn truncate(s: &str, max_chars: usize) -> String {
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
    fn truncate_short_string_unchanged() {
        assert_eq!(truncate("hello", 10), "hello");
    }

    #[test]
    fn truncate_long_string_appends_ellipsis() {
        let r = truncate("あいうえおかきくけこさしすせそ", 5);
        assert!(r.ends_with('…'));
        assert!(r.chars().count() <= 6);
    }

    #[test]
    fn skip_reason_none_means_no_llm() {
        assert!(skip_reason(None).is_some());
    }

    #[tokio::test]
    async fn generate_skips_without_llm() {
        use crate::infra::database;
        use std::path::PathBuf;
        let db = database::init_pool(&PathBuf::from(":memory:"))
            .await
            .unwrap();
        let spec = WebReportSpec {
            category: "research_report",
            title: "t".into(),
            system_prompt: "s".into(),
            user_prompt: "u".into(),
            article_ids: String::new(),
            max_tokens: 100,
            include_citations: true,
        };
        let outcome = generate_web_report(&db, None, spec).await.unwrap();
        assert!(matches!(outcome, ReportOutcome::Skipped(_)));
    }
}
