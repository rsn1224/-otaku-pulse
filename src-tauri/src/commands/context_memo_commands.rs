use crate::error::CmdResult;
use crate::services::context_memo_service;
use crate::state::AppState;
use tauri::State;

/// 記事のコンテキスト AI メモを取得する（キャッシュがなければ生成する）。
/// LLM が未設定の場合はフォールバックメモを返す。
#[tauri::command]
pub async fn get_context_memo(
    state: State<'_, AppState>,
    article_id: i64,
) -> CmdResult<String> {
    let llm_box;
    let llm: Option<&dyn crate::infra::llm_client::LlmClient> =
        match build_llm_client(&state) {
            Ok(client) => {
                llm_box = client;
                Some(&*llm_box)
            }
            Err(_) => None,
        };

    match llm {
        Some(client) => {
            context_memo_service::get_or_generate_context_memo(&state.db, client, article_id).await
        }
        None => {
            // LLM 未設定時のフォールバック
            Ok("LLM が未設定のためコンテキストメモを生成できません。設定画面から LLM を設定してください。".to_string())
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
        crate::infra::llm_client::LlmProvider::Ollama => Ok(Box::new(
            crate::infra::ollama_client::OllamaClient::new(
                settings.ollama_base_url.clone(),
                settings.ollama_model.clone(),
                (*state.http).clone(),
            ),
        )),
    }
}
