use tauri::{State, AppHandle};
use serde::{Deserialize, Serialize};
use crate::state::AppState;
use crate::error::AppError;
use crate::services::scheduler::SchedulerConfig;
use crate::commands::llm;

#[derive(Debug, Serialize, Deserialize)]
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

/// 現在のスケジューラー設定を取得
#[tauri::command]
pub async fn get_scheduler_config(
    _app_handle: AppHandle,
) -> Result<SchedulerSettings, AppError> {
    // TODO: tauri-plugin-storeから読み込む（現在一時的実装）
    Ok(SchedulerConfig::default().into())
}

/// スケジューラー設定を保存（tauri-plugin-storeに永続化）
#[tauri::command]
pub async fn set_scheduler_config(
    _app_handle: AppHandle,
    _state: State<'_, AppState>,
    config: SchedulerSettings,
) -> Result<(), AppError> {
    // TODO: tauri-plugin-storeに保存（現在一時的実装）
    tracing::info!("スケジューラー設定更新: {:?}", config);
    Ok(())
}

/// 手動で今すぐダイジェスト生成（スケジュールを待たずに実行）
#[tauri::command]
pub async fn run_digest_now(
    _state: State<'_, AppState>,
) -> Result<Vec<llm::DigestResult>, AppError> {
    let categories = ["anime", "manga", "game", "pc"];
    let mut results = Vec::new();
    
    for category in &categories {
        // TODO: generate_llm_digestを呼ぶ実装が必要
        tracing::info!("手動ダイジェスト生成対象: {}", category);
        
        // 現時点ではスタブ実装
        let stub_result = llm::DigestResult {
            category: category.to_string(),
            summary: format!("{}のスタブ要約", category),
            article_count: 0,
            generated_at: chrono::Utc::now().to_rfc3339(),
            is_ai_generated: false,
            provider: None,
            model: None,
            fallback_reason: Some("手動生成スタブ".to_string()),
        };
        results.push(stub_result);
    }
    
    Ok(results)
}
