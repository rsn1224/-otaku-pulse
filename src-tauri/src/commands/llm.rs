#![allow(dead_code)]
use crate::error::{AppError, CmdResult};
use crate::infra::llm_client::{LlmClient, LlmProvider};
use crate::infra::ollama_client::OllamaClient;
use crate::infra::perplexity_client::PerplexitySonarClient;
use crate::state::{AppState, LlmSettings};
use std::sync::Arc;
use tauri::State;

// ---------------------------------------------------------------------------
// LLM helpers (shared by discover_ai / discover_profile)
// ---------------------------------------------------------------------------

pub(super) enum LlmBox {
    Perplexity(PerplexitySonarClient),
    Ollama(OllamaClient),
}

pub(super) fn clone_llm_settings(state: &AppState) -> CmdResult<LlmSettings> {
    let guard = state
        .llm
        .read()
        .map_err(|e| AppError::Internal(format!("LLM settings lock: {e}")))?;
    Ok(guard.clone())
}

pub(super) fn build_llm_client(settings: &LlmSettings, http: &reqwest::Client) -> CmdResult<LlmBox> {
    match settings.provider {
        LlmProvider::PerplexitySonar => {
            let api_key = settings.perplexity_api_key.clone().ok_or_else(|| {
                AppError::Llm("Perplexity API キーが未設定です".into())
            })?;
            Ok(LlmBox::Perplexity(PerplexitySonarClient::new(
                api_key,
                http.clone(),
            )))
        }
        LlmProvider::Ollama => Ok(LlmBox::Ollama(OllamaClient::new(
            settings.ollama_base_url.clone(),
            settings.ollama_model.clone(),
            http.clone(),
        ))),
    }
}

pub(super) fn as_llm_client(client: &LlmBox) -> &dyn LlmClient {
    match client {
        LlmBox::Perplexity(c) => c,
        LlmBox::Ollama(c) => c,
    }
}

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
        let llm = state
            .llm
            .read()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        (
            llm.provider.clone(),
            llm.perplexity_api_key.is_some(),
            llm.ollama_base_url.clone(),
            llm.ollama_model.clone(),
        )
    };

    let available_models = crate::infra::ollama_client::check_status(&http, &base_url)
        .await
        .unwrap_or_default();

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
    let mut llm = state
        .llm
        .write()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    llm.provider = provider.clone();
    tracing::info!("LLM provider set to: {:?}", provider);
    Ok(())
}

#[tauri::command]
pub async fn set_perplexity_api_key(
    api_key: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut llm = state
        .llm
        .write()
        .map_err(|e| AppError::Internal(e.to_string()))?;
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
    let mut llm = state
        .llm
        .write()
        .map_err(|e| AppError::Internal(e.to_string()))?;
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
        let llm = state
            .llm
            .read()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        llm.ollama_base_url.clone()
    };
    crate::infra::ollama_client::check_status(&http, &base_url).await
}

