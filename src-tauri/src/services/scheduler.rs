use chrono::{Local, Timelike};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};

use crate::state::AppState;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SchedulerConfig {
    /// フィード収集間隔（分）。デフォルト 60
    pub collect_interval_minutes: u64,
    /// ダイジェスト生成時刻（時）。デフォルト 8（= 08:00）
    pub digest_hour: u32,
    /// ダイジェスト生成時刻（分）。デフォルト 0（= 08:00）
    pub digest_minute: u32,
    /// スケジューラ有効フラグ
    pub enabled: bool,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            collect_interval_minutes: 60,
            digest_hour: 8,
            digest_minute: 0,
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CollectResult {
    pub fetched: usize,
    pub saved: usize,
}

/// アプリ起動時に呼び出す。tokio::spawn でバックグラウンド実行。
/// CancellationToken でグレースフルシャットダウン、watch::Receiver で設定ホットリロードを実現。
pub fn start(
    app_handle: AppHandle,
    _config: SchedulerConfig,
    db_pool: Arc<sqlx::SqlitePool>,
    http_client: Arc<reqwest::Client>,
    app_state: AppState,
    token: CancellationToken,
    config_rx: watch::Receiver<SchedulerConfig>,
) {
    let app_handle_clone = app_handle.clone();
    let token_clone = token.clone();
    let config_rx_clone = config_rx.clone();

    // 収集ループ (tauri::async_runtime はsetup()内でも利用可能)
    tauri::async_runtime::spawn(async move {
        collect_loop(app_handle_clone, db_pool, http_client, token_clone, config_rx_clone).await;
    });

    // ダイジェストループ
    let app_handle_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        digest_loop(app_handle_clone, app_state, token, config_rx).await;
    });
}

/// 収集ループ — tokio::select! で CancellationToken / config 変更 / タイマーを多重待ちする
async fn collect_loop(
    app_handle: AppHandle,
    db_pool: Arc<sqlx::SqlitePool>,
    http_client: Arc<reqwest::Client>,
    token: CancellationToken,
    mut config_rx: watch::Receiver<SchedulerConfig>,
) {
    let initial_config = config_rx.borrow_and_update().clone();
    let interval_dur = Duration::from_secs(initial_config.collect_interval_minutes * 60);
    let mut timer = tokio::time::interval_at(
        tokio::time::Instant::now() + interval_dur,
        interval_dur,
    );

    loop {
        tokio::select! {
            _ = token.cancelled() => {
                info!("collect_loop: shutdown signal received");
                break;
            }
            result = config_rx.changed() => {
                if result.is_err() {
                    // Sender dropped — shut down
                    info!("collect_loop: config channel closed, shutting down");
                    break;
                }
                let new_config = config_rx.borrow_and_update().clone();
                let dur = Duration::from_secs(new_config.collect_interval_minutes * 60);
                timer = tokio::time::interval_at(tokio::time::Instant::now() + dur, dur);
                info!(
                    interval_min = new_config.collect_interval_minutes,
                    "collect_loop: config updated"
                );
            }
            _ = timer.tick() => {
                let config = config_rx.borrow().clone();
                if !config.enabled {
                    continue;
                }

                info!("スケジューラ: フィード収集開始");

                let result = match super::collector::refresh_all(&db_pool, &http_client).await {
                    Ok((saved, _processed, errors)) => {
                        info!(saved, error_count = errors.len(), "スケジューラ: フィード収集完了");

                        // If all feeds failed and nothing was saved, emit collect-failed
                        if !errors.is_empty() && saved == 0 {
                            if let Err(e) = app_handle.emit(
                                "collect-failed",
                                serde_json::json!({
                                    "message": "All feeds failed to fetch",
                                    "errorCount": errors.len()
                                }),
                            ) {
                                warn!("collect-failed イベント送信失敗: {}", e);
                            }
                        }

                        CollectResult {
                            fetched: saved as usize,
                            saved: saved as usize,
                        }
                    }
                    Err(e) => {
                        warn!(error = %e, "スケジューラ: フィード収集失敗");

                        // Fatal error — emit collect-failed
                        if let Err(e2) = app_handle.emit(
                            "collect-failed",
                            serde_json::json!({
                                "message": format!("Feed collection error: {e}"),
                                "errorCount": 0
                            }),
                        ) {
                            warn!("collect-failed イベント送信失敗: {}", e2);
                        }

                        CollectResult {
                            fetched: 0,
                            saved: 0,
                        }
                    }
                };

                // FE にイベント送信
                if let Err(e) = app_handle.emit("collect-completed", &result) {
                    warn!("収集完了イベント送信失敗: {}", e);
                }

                // 新着記事通知 (saved > 0 の場合のみ)
                if result.saved > 0 {
                    crate::infra::notification::notify_important_article(
                        &app_handle,
                        "新着記事",
                        &format!("{}件の新着記事", result.saved),
                    );
                }
            }
        }
    }
}

/// ダイジェスト生成ループ — tokio::select! で CancellationToken / config 変更 / タイマーを多重待ちする
async fn digest_loop(
    app_handle: AppHandle,
    state: AppState,
    token: CancellationToken,
    mut config_rx: watch::Receiver<SchedulerConfig>,
) {
    loop {
        let config = config_rx.borrow().clone();
        // 次の digest_hour:digest_minute まで待機
        let wait = seconds_until(config.digest_hour, config.digest_minute);

        tokio::select! {
            _ = token.cancelled() => {
                info!("digest_loop: shutdown signal received");
                break;
            }
            result = config_rx.changed() => {
                if result.is_err() {
                    info!("digest_loop: config channel closed, shutting down");
                    break;
                }
                let new_config = config_rx.borrow_and_update().clone();
                info!(
                    digest_hour = new_config.digest_hour,
                    digest_minute = new_config.digest_minute,
                    "digest_loop: config updated, recalculating schedule"
                );
                // Loop restarts, recalculating wait from new config
                continue;
            }
            _ = tokio::time::sleep(Duration::from_secs(wait)) => {
                // Time to generate digest
            }
        }

        let config = config_rx.borrow().clone();
        if !config.enabled {
            continue;
        }

        info!("スケジューラー: ダイジェスト生成開始");

        // LLM クライアントを構築
        let llm_client = match build_scheduler_llm_client(&state) {
            Ok(client) => client,
            Err(e) => {
                warn!(error = %e, "スケジューラー: LLM クライアント構築失敗、スキップ");
                continue;
            }
        };

        // 4カテゴリーを順番に生成
        for category in &["anime", "manga", "game", "pc"] {
            match super::digest_generator::generate(&state.db, &*llm_client, category, 24).await {
                Ok(result) => {
                    info!(category, article_count = result.article_count, "ダイジェスト生成完了");

                    // DB に保存
                    let digest = crate::models::Digest {
                        id: 0,
                        category: result.category.clone(),
                        title: format!("{}ダイジェスト", category),
                        content_markdown: result.summary,
                        content_html: None,
                        article_ids: String::new(),
                        model_used: result.model,
                        token_count: None,
                        generated_at: result.generated_at,
                    };
                    if let Err(e) = super::digest_queries::insert_digest(&state.db, &digest).await {
                        warn!(error = %e, category, "ダイジェスト DB 保存失敗");
                    }

                    crate::infra::notification::notify_digest_ready(
                        &app_handle,
                        category,
                        result.article_count,
                    );
                }
                Err(e) => {
                    warn!(error = %e, category, "ダイジェスト生成失敗");
                }
            }
        }

        info!("スケジューラー: ダイジェスト生成完了");
    }
}

/// スケジューラー用 LLM クライアント構築
fn build_scheduler_llm_client(
    state: &AppState,
) -> Result<Box<dyn crate::infra::llm_client::LlmClient>, crate::error::AppError> {
    let settings = state
        .llm
        .read()
        .map_err(|e| crate::error::AppError::Internal(format!("LLM settings lock: {e}")))?;

    match settings.provider {
        crate::infra::llm_client::LlmProvider::PerplexitySonar => {
            let api_key = settings
                .perplexity_api_key
                .clone()
                .ok_or_else(|| crate::error::AppError::Llm("Perplexity API キーが未設定です".into()))?;
            Ok(Box::new(crate::infra::perplexity_client::PerplexitySonarClient::new(
                api_key,
                (*state.http).clone(),
            )))
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

/// 次の hour:minute まで何秒待つか計算（日本時間 JST 基準）
fn seconds_until(hour: u32, minute: u32) -> u64 {
    let now = Local::now();

    let target = match now
        .with_hour(hour)
        .and_then(|dt| dt.with_minute(minute))
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0))
    {
        Some(t) => t,
        None => return 86400, // フォールバック: 24時間後
    };

    let target = if target <= now {
        target + chrono::Duration::days(1)
    } else {
        target
    };

    (target - now)
        .to_std()
        .unwrap_or(Duration::from_secs(86400))
        .as_secs()
}
