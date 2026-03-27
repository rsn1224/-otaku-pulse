use crate::commands::llm;
use crate::error::AppError;
use crate::services::digest_generator;
use crate::services::scheduler::SchedulerConfig;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_store::StoreExt;

const STORE_PATH: &str = "scheduler.json";
const STORE_KEY: &str = "scheduler_config";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerSettings {
    pub collect_interval_minutes: u64,
    pub digest_hour: u32,
    pub digest_minute: u32,
    pub enabled: bool,
}

impl From<SchedulerConfig> for SchedulerSettings {
    fn from(config: SchedulerConfig) -> Self {
        Self {
            collect_interval_minutes: config.collect_interval_minutes,
            digest_hour: config.digest_hour,
            digest_minute: config.digest_minute,
            enabled: config.enabled,
        }
    }
}

impl From<SchedulerSettings> for SchedulerConfig {
    fn from(settings: SchedulerSettings) -> Self {
        Self {
            collect_interval_minutes: settings.collect_interval_minutes,
            digest_hour: settings.digest_hour,
            digest_minute: settings.digest_minute,
            enabled: settings.enabled,
        }
    }
}

/// 現在のスケジューラー設定を取得（tauri-plugin-store から読み込み）
#[tauri::command]
pub async fn get_scheduler_config(app_handle: AppHandle) -> Result<SchedulerSettings, AppError> {
    let store = app_handle
        .store(STORE_PATH)
        .map_err(|e| AppError::Internal(format!("Store open error: {e}")))?;

    if let Some(value) = store.get(STORE_KEY) {
        let settings: SchedulerSettings = serde_json::from_value(value)
            .unwrap_or_else(|e| {
                tracing::warn!(error = %e, "Failed to parse scheduler config from store, using defaults");
                SchedulerConfig::default().into()
            });
        Ok(settings)
    } else {
        Ok(SchedulerConfig::default().into())
    }
}

/// スケジューラー設定を保存（tauri-plugin-store に永続化）
#[tauri::command]
pub async fn set_scheduler_config(
    app_handle: AppHandle,
    _state: State<'_, AppState>,
    config: SchedulerSettings,
) -> Result<(), AppError> {
    let store = app_handle
        .store(STORE_PATH)
        .map_err(|e| AppError::Internal(format!("Store open error: {e}")))?;

    let value = serde_json::to_value(&config)
        .map_err(|e| AppError::Internal(format!("Serialize error: {e}")))?;

    store.set(STORE_KEY, value);
    store
        .save()
        .map_err(|e| AppError::Internal(format!("Store save error: {e}")))?;

    tracing::info!(?config, "Scheduler config saved to store");
    Ok(())
}

/// 手動で今すぐダイジェスト生成（スケジュールを待たずに実行）
#[tauri::command]
pub async fn run_digest_now(
    state: State<'_, AppState>,
) -> Result<Vec<llm::DigestResult>, AppError> {
    let categories = ["anime", "manga", "game", "pc"];

    // LLM クライアントを構築
    let settings = llm::clone_llm_settings(&state)?;
    let client_box = llm::build_llm_client(&settings, &state.http)?;
    let client = llm::as_llm_client(&client_box);

    let mut results = Vec::new();
    for category in &categories {
        tracing::info!(category, "Generating digest");

        let digest = digest_generator::generate(&state.db, client, category, 24).await?;

        results.push(llm::DigestResult {
            category: digest.category,
            summary: digest.summary,
            article_count: digest.article_count,
            generated_at: digest.generated_at,
            is_ai_generated: digest.is_ai_generated,
            provider: digest.provider,
            model: digest.model,
            fallback_reason: digest.fallback_reason,
        });
    }

    Ok(results)
}
