use crate::error::CmdResult;
use crate::models::DigestDto;
use crate::models::TodayViewItem;
use crate::services::{
    digest_queries, research_report_service, today_view_service, weekly_report_service,
};
use crate::state::AppState;
use sqlx::SqlitePool;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn get_digests(
    db: State<'_, SqlitePool>,
    category: Option<String>,
) -> CmdResult<Vec<DigestDto>> {
    digest_queries::list_digests(&db, category.as_deref()).await
}

#[tauri::command]
pub async fn get_latest_digest(
    db: State<'_, SqlitePool>,
    category: String,
) -> CmdResult<Option<DigestDto>> {
    digest_queries::get_latest_digest(&db, &category).await
}

#[tauri::command]
pub async fn delete_digest(db: State<'_, SqlitePool>, digest_id: i64) -> CmdResult<()> {
    digest_queries::delete_digest(&db, digest_id).await
}

#[tauri::command]
pub async fn get_today_view(state: State<'_, AppState>) -> CmdResult<Vec<TodayViewItem>> {
    // LLM クライアントを構築（失敗してもフォールバックで動作する）
    let llm_box = build_llm_client_opt(&state);
    let llm: Option<&dyn crate::infra::llm_client::LlmClient> = llm_box
        .as_deref()
        .map(|c| c as &dyn crate::infra::llm_client::LlmClient);

    today_view_service::get_today_view(&state.db, llm).await
}

/// 週次 Deep Research レポートを手動でトリガーする。
/// Perplexity API Key が未設定の場合はスキップ理由を返す。
#[tauri::command]
pub async fn run_weekly_report_now(state: State<'_, AppState>) -> CmdResult<String> {
    let llm_box = build_llm_client_opt(&state);
    let llm: Option<&dyn crate::infra::llm_client::LlmClient> = llm_box
        .as_deref()
        .map(|c| c as &dyn crate::infra::llm_client::LlmClient);

    let result = weekly_report_service::generate_weekly_report(&state.db, llm).await?;

    if let Some(reason) = result.skipped_reason {
        Ok(format!("スキップ: {reason}"))
    } else {
        Ok(format!(
            "{}件のレポートを生成しました",
            result.reports_generated
        ))
    }
}

/// 任意クエリの調査レポート (機能C) を生成する。Perplexity 未設定時は skip 理由を返す。
/// 生成したレポートは設定が有効なら Markdown としても書き出す (機能E)。
#[tauri::command]
pub async fn run_research_report(
    app: AppHandle,
    state: State<'_, AppState>,
    query: String,
) -> CmdResult<String> {
    let llm_box = build_llm_client_opt(&state);
    let llm: Option<&dyn crate::infra::llm_client::LlmClient> = llm_box
        .as_deref()
        .map(|c| c as &dyn crate::infra::llm_client::LlmClient);

    let result = research_report_service::generate_research_report(&state.db, llm, &query).await?;

    if let Some(reason) = result.skipped_reason {
        return Ok(format!("スキップ: {reason}"));
    }

    if let Some(digest) = result.digest {
        crate::services::scheduler::export_digest_if_enabled(&state.db, &app, &digest).await;
        Ok(format!("調査レポートを生成しました: {}", digest.title))
    } else {
        Ok("調査レポートは生成されませんでした".to_string())
    }
}

/// `build_llm_client` のエラーをログしてから Option 化する。
/// 「LLM 未設定」と内部エラー (lock poison / 設定不整合) を silent に同一視せず、
/// warn を残してから None フォールバックする (silent failure 防止)。
fn build_llm_client_opt(
    state: &AppState,
) -> Option<Box<dyn crate::infra::llm_client::LlmClient + Send + Sync>> {
    match build_llm_client(state) {
        Ok(client) => Some(client),
        Err(e) => {
            tracing::warn!(error = %e, "LLM クライアント構築失敗、フォールバック動作で継続");
            None
        }
    }
}

fn build_llm_client(
    state: &AppState,
) -> Result<Box<dyn crate::infra::llm_client::LlmClient + Send + Sync>, crate::error::AppError> {
    let settings = state
        .llm
        .read()
        .map_err(|e| crate::error::AppError::Internal(format!("LLM settings lock: {e}")))?;

    match settings.provider {
        crate::infra::llm_client::LlmProvider::PerplexitySonar => {
            let api_key = settings
                .perplexity_api_key
                .clone()
                .ok_or_else(|| crate::error::AppError::Llm("Perplexity API キー未設定".into()))?;
            Ok(Box::new(
                crate::infra::perplexity_client::PerplexitySonarClient::new(
                    api_key,
                    (*state.http).clone(),
                ),
            ))
        }
        crate::infra::llm_client::LlmProvider::Ollama => {
            Ok(Box::new(crate::infra::ollama_client::OllamaClient::new(
                settings.ollama_base_url.clone(),
                settings.ollama_model.clone(),
                (*state.http).clone(),
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::models::Digest;
    use crate::services::{digest_queries, test_helpers::setup_test_db};

    fn sample_digest(category: &str, generated_at: &str) -> Digest {
        Digest {
            id: 0,
            category: category.to_string(),
            title: format!("{category} ダイジェスト"),
            content_markdown: "# Summary".to_string(),
            content_html: None,
            article_ids: "1,2".to_string(),
            model_used: Some("test-model".to_string()),
            token_count: Some(50),
            generated_at: generated_at.to_string(),
        }
    }

    #[tokio::test]
    async fn test_get_latest_digest_returns_newest() {
        let db = setup_test_db().await;

        digest_queries::insert_digest(&db, &sample_digest("anime", "2025-01-01T00:00:00Z"))
            .await
            .unwrap();
        digest_queries::insert_digest(&db, &sample_digest("anime", "2025-01-02T00:00:00Z"))
            .await
            .unwrap();

        let latest = digest_queries::get_latest_digest(&db, "anime")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(latest.generated_at, "2025-01-02T00:00:00Z");
    }

    #[tokio::test]
    async fn test_get_latest_digest_none_for_empty_category() {
        let db = setup_test_db().await;

        let result = digest_queries::get_latest_digest(&db, "manga")
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete_digest_removes_entry() {
        let db = setup_test_db().await;

        let id = digest_queries::insert_digest(&db, &sample_digest("game", "2025-01-01T00:00:00Z"))
            .await
            .unwrap();

        digest_queries::delete_digest(&db, id).await.unwrap();

        let digests = digest_queries::list_digests(&db, Some("game"))
            .await
            .unwrap();
        assert!(digests.is_empty());
    }

    #[tokio::test]
    async fn test_list_digests_filters_by_category() {
        let db = setup_test_db().await;

        digest_queries::insert_digest(&db, &sample_digest("anime", "2025-01-01T00:00:00Z"))
            .await
            .unwrap();
        digest_queries::insert_digest(&db, &sample_digest("game", "2025-01-01T00:00:00Z"))
            .await
            .unwrap();

        let anime = digest_queries::list_digests(&db, Some("anime"))
            .await
            .unwrap();
        assert_eq!(anime.len(), 1);

        let all = digest_queries::list_digests(&db, None).await.unwrap();
        assert_eq!(all.len(), 2);
    }
}
