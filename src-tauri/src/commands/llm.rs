use std::sync::Arc;
use tauri::State;
use crate::state::AppState;
use crate::error::AppError;
use crate::infra::llm_client::{LlmProvider, LlmClient};
use crate::infra::perplexity_client::PerplexitySonarClient;
use crate::infra::ollama_client::OllamaClient;
use crate::services::digest_generator;

#[derive(serde::Serialize)]
pub struct LlmSettingsResponse {
    pub provider: LlmProvider,
    pub perplexity_api_key_set: bool,
    pub ollama_base_url: String,
    pub ollama_model: String,
    pub available_ollama_models: Vec<String>,
    pub ollama_running: bool,
}

#[derive(serde::Serialize)]
pub struct DigestResult {
    pub category: String,
    pub summary: String,
    pub article_count: usize,
    pub generated_at: String,
    pub is_ai_generated: bool,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub fallback_reason: Option<String>,
}

#[tauri::command]
pub async fn get_llm_settings(
    http: State<'_, Arc<reqwest::Client>>,
    state: State<'_, AppState>,
) -> Result<LlmSettingsResponse, AppError> {
    // RwLock guard を即座に drop するためブロックで囲む
    let (provider, api_key_set, base_url, model) = {
        let llm = state.llm.read().map_err(|e| AppError::Internal(e.to_string()))?;
        (
            llm.provider.clone(),
            llm.perplexity_api_key.is_some(),
            llm.ollama_base_url.clone(),
            llm.ollama_model.clone(),
        )
    };

    let available_models = crate::infra::ollama_client::check_status(
        &http, &base_url,
    ).await.unwrap_or_default();

    let ollama_running = !available_models.is_empty();

    Ok(LlmSettingsResponse {
        provider,
        perplexity_api_key_set: api_key_set,
        ollama_base_url: base_url,
        ollama_model: model,
        available_ollama_models: available_models,
        ollama_running,
    })
}

#[tauri::command]
pub async fn set_llm_provider(
    provider: LlmProvider,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut llm = state.llm.write().map_err(|e| AppError::Internal(e.to_string()))?;
    llm.provider = provider.clone();
    tracing::info!("LLM provider set to: {:?}", provider);
    Ok(())
}

#[tauri::command]
pub async fn set_perplexity_api_key(
    api_key: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut llm = state.llm.write().map_err(|e| AppError::Internal(e.to_string()))?;
    llm.perplexity_api_key = Some(api_key);
    tracing::info!("Perplexity API key set");
    Ok(())
}

#[tauri::command]
pub async fn set_ollama_settings(
    base_url: String,
    model: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut llm = state.llm.write().map_err(|e| AppError::Internal(e.to_string()))?;
    llm.ollama_base_url = base_url.clone();
    llm.ollama_model = model.clone();
    tracing::info!("Ollama settings updated: {} @ {}", model, base_url);
    Ok(())
}

#[tauri::command]
pub async fn check_ollama_status(
    http: State<'_, Arc<reqwest::Client>>,
    state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    let base_url = {
        let llm = state.llm.read().map_err(|e| AppError::Internal(e.to_string()))?;
        llm.ollama_base_url.clone()
    };
    crate::infra::ollama_client::check_status(&http, &base_url).await
}

#[tauri::command]
pub async fn generate_llm_digest(
    category: String,
    state: State<'_, AppState>,
    http: State<'_, Arc<reqwest::Client>>,
) -> Result<DigestResult, AppError> {
    // RwLock guard を drop してから async 処理するため、先に値をコピー
    let client: Box<dyn LlmClient> = {
        let llm = state.llm.read().map_err(|e| AppError::Internal(e.to_string()))?;
        match llm.provider {
            LlmProvider::PerplexitySonar => {
                let api_key = llm.perplexity_api_key.as_ref()
                    .ok_or_else(|| AppError::Unauthorized(
                        "Perplexity APIキーが設定されていません".to_string(),
                    ))?;
                Box::new(PerplexitySonarClient::new(api_key.clone(), (**http).clone()))
            }
            LlmProvider::Ollama => {
                Box::new(OllamaClient::new(
                    llm.ollama_base_url.clone(),
                    llm.ollama_model.clone(),
                    (**http).clone(),
                ))
            }
        }
    };

    let result = digest_generator::generate(&state.db, client.as_ref(), &category, 24).await?;

    Ok(DigestResult {
        category: result.category,
        summary: result.summary,
        article_count: result.article_count,
        generated_at: result.generated_at,
        is_ai_generated: result.is_ai_generated,
        provider: result.provider,
        model: result.model,
        fallback_reason: result.fallback_reason,
    })
}
