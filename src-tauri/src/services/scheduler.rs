use chrono::{Datelike, Local, Timelike};
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
    let db_pool_external = db_pool.clone();
    let db_pool_weekly = db_pool.clone();
    let http_client_external = http_client.clone();
    let token_external = token.clone();
    tauri::async_runtime::spawn(async move {
        collect_loop(
            app_handle_clone,
            db_pool,
            http_client,
            token_clone,
            config_rx_clone,
        )
        .await;
    });

    // v1.1: AniList / Steam 外部同期ループ
    tauri::async_runtime::spawn(async move {
        external_sync_loop(db_pool_external, http_client_external, token_external).await;
    });

    // v1.1 P2: 週次 Deep Research レポートループ
    let app_state_weekly = app_state.clone();
    let token_weekly = token.clone();
    tauri::async_runtime::spawn(async move {
        weekly_report_loop(db_pool_weekly, app_state_weekly, token_weekly).await;
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
    let mut timer =
        tokio::time::interval_at(tokio::time::Instant::now() + interval_dur, interval_dur);

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
                        if !errors.is_empty()
                            && saved == 0
                            && let Err(e) = app_handle.emit(
                                "collect-failed",
                                serde_json::json!({
                                    "message": "All feeds failed to fetch",
                                    "errorCount": errors.len()
                                }),
                            )
                        {
                            warn!("collect-failed イベント送信失敗: {}", e);
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

        // 4カテゴリーを並列生成 (PERF-02: tokio::join! で ~4x 高速化)
        const DIGEST_TIMEOUT_SECS: u64 = 120;
        let timeout_dur = Duration::from_secs(DIGEST_TIMEOUT_SECS);
        let (r_anime, r_manga, r_game, r_pc) = tokio::join!(
            tokio::time::timeout(
                timeout_dur,
                generate_and_save_digest(&state.db, &*llm_client, &app_handle, "anime")
            ),
            tokio::time::timeout(
                timeout_dur,
                generate_and_save_digest(&state.db, &*llm_client, &app_handle, "manga")
            ),
            tokio::time::timeout(
                timeout_dur,
                generate_and_save_digest(&state.db, &*llm_client, &app_handle, "game")
            ),
            tokio::time::timeout(
                timeout_dur,
                generate_and_save_digest(&state.db, &*llm_client, &app_handle, "pc")
            ),
        );
        for (category, result) in [
            ("anime", r_anime),
            ("manga", r_manga),
            ("game", r_game),
            ("pc", r_pc),
        ] {
            match result {
                Ok(Ok(())) => {}
                Ok(Err(e)) => warn!(error = %e, category, "ダイジェスト生成失敗"),
                Err(_elapsed) => warn!(
                    category,
                    timeout_secs = DIGEST_TIMEOUT_SECS,
                    "ダイジェスト生成タイムアウト"
                ),
            }
        }

        info!("スケジューラー: ダイジェスト生成完了");

        // Today View を生成（LLM が利用可能な場合）
        let tv_llm = build_scheduler_llm_client(&state);
        match tv_llm {
            Ok(client) => {
                match super::today_view_service::get_today_view(&state.db, Some(&*client)).await {
                    Ok(items) => info!(count = items.len(), "Today View 生成完了"),
                    Err(e) => warn!(error = %e, "Today View 生成失敗"),
                }
            }
            Err(_) => {
                // LLM 未設定の場合はフォールバック
                let _ = super::today_view_service::get_today_view(&state.db, None).await;
            }
        }
    }
}

/// Per-category digest generation with logging. Used by tokio::join! for parallelism.
async fn generate_and_save_digest(
    db: &sqlx::SqlitePool,
    llm: &dyn crate::infra::llm_client::LlmClient,
    app_handle: &AppHandle,
    category: &str,
) -> Result<(), crate::error::AppError> {
    let result = super::digest_generator::generate(db, llm, category, 24).await?;
    tracing::info!(
        category,
        article_count = result.article_count,
        "ダイジェスト生成完了"
    );
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
    if let Err(e) = super::digest_queries::insert_digest(db, &digest).await {
        tracing::warn!(error = %e, category, "ダイジェスト DB 保存失敗");
    }
    crate::infra::notification::notify_digest_ready(app_handle, category, result.article_count);
    Ok(())
}

/// スケジューラー用 LLM クライアント構築
fn build_scheduler_llm_client(
    state: &AppState,
) -> Result<Arc<dyn crate::infra::llm_client::LlmClient + Send + Sync>, crate::error::AppError> {
    let settings = state
        .llm
        .read()
        .map_err(|e| crate::error::AppError::Internal(format!("LLM settings lock: {e}")))?;

    match settings.provider {
        crate::infra::llm_client::LlmProvider::PerplexitySonar => {
            let api_key = settings.perplexity_api_key.clone().ok_or_else(|| {
                crate::error::AppError::Llm("Perplexity API キーが未設定です".into())
            })?;
            Ok(Arc::new(
                crate::infra::perplexity_client::PerplexitySonarClient::new(
                    api_key,
                    (*state.http).clone(),
                ),
            ))
        }
        crate::infra::llm_client::LlmProvider::Ollama => {
            Ok(Arc::new(crate::infra::ollama_client::OllamaClient::new(
                settings.ollama_base_url.clone(),
                settings.ollama_model.clone(),
                (*state.http).clone(),
            )))
        }
    }
}

/// 週次 Deep Research レポートループ
/// 毎日 digest_hour の1時間後に起動し、日曜日のみレポートを生成する。
/// Perplexity API Key が未設定の場合はスキップ。
async fn weekly_report_loop(
    db_pool: Arc<sqlx::SqlitePool>,
    state: AppState,
    token: CancellationToken,
) {
    // 24時間ごとにチェック（起動直後の初回 tick は読み捨て）
    const CHECK_INTERVAL_SECS: u64 = 24 * 60 * 60;
    let mut timer = tokio::time::interval(Duration::from_secs(CHECK_INTERVAL_SECS));
    timer.tick().await;

    loop {
        tokio::select! {
            _ = token.cancelled() => {
                info!("weekly_report_loop: shutdown signal received");
                break;
            }
            _ = timer.tick() => {}
        }

        // 日曜日のみ実行 (chrono::Weekday::Sun)
        let today = Local::now().weekday();
        if today != chrono::Weekday::Sun {
            continue;
        }

        info!("週次レポート生成開始 (日曜日トリガー)");

        let llm_arc = build_scheduler_llm_client(&state).ok();
        let llm_ref: Option<&dyn crate::infra::llm_client::LlmClient> = llm_arc
            .as_deref()
            .map(|c| c as &dyn crate::infra::llm_client::LlmClient);

        let result = super::weekly_report_service::generate_weekly_report(&db_pool, llm_ref).await;

        match result {
            Ok(r) if r.reports_generated > 0 => {
                info!(count = r.reports_generated, "週次レポート生成完了");
            }
            Ok(r) => {
                if let Some(reason) = r.skipped_reason {
                    info!(reason, "週次レポートスキップ");
                }
            }
            Err(e) => warn!(error = %e, "週次レポート生成失敗"),
        }
    }
}

const ANILIST_SYNC_INTERVAL_SECS: u64 = 6 * 60 * 60;
const STEAM_SYNC_INTERVAL_SECS: u64 = 24 * 60 * 60;

/// AniList / Steam の定期同期ループ
async fn external_sync_loop(
    db_pool: Arc<sqlx::SqlitePool>,
    http_client: Arc<reqwest::Client>,
    token: CancellationToken,
) {
    let mut anilist_timer = tokio::time::interval(Duration::from_secs(ANILIST_SYNC_INTERVAL_SECS));
    let mut steam_timer = tokio::time::interval(Duration::from_secs(STEAM_SYNC_INTERVAL_SECS));
    // 起動直後の即時 tick を読み捨てる（初回は遅延あり）
    anilist_timer.tick().await;
    steam_timer.tick().await;

    loop {
        tokio::select! {
            _ = token.cancelled() => {
                info!("external_sync_loop: shutdown signal received");
                break;
            }
            _ = anilist_timer.tick() => {
                let username = match super::anilist_watch_service::get_anilist_username(&db_pool).await {
                    Ok(u) => u,
                    Err(e) => { warn!(error = %e, "AniList username fetch failed"); continue; }
                };
                match super::anilist_watch_service::sync_anilist_watchlist(
                    &db_pool,
                    http_client.clone(),
                    &username,
                ).await {
                    Ok(r) if r.synced_count > 0 => info!(count = r.synced_count, "AniList watchlist synced"),
                    Ok(_) => {}
                    Err(e) => warn!(error = %e, "AniList watchlist sync failed"),
                }
            }
            _ = steam_timer.tick() => {
                let (api_key, steam_id) = match super::steam_sync_service::get_steam_credentials(&db_pool).await {
                    Ok(creds) => creds,
                    Err(e) => { warn!(error = %e, "Steam credentials fetch failed"); continue; }
                };
                match super::steam_sync_service::sync_steam_games(
                    &db_pool,
                    http_client.clone(),
                    &api_key,
                    &steam_id,
                ).await {
                    Ok(r) if r.synced_count > 0 => info!(count = r.synced_count, "Steam games synced"),
                    Ok(_) => {}
                    Err(e) => warn!(error = %e, "Steam games sync failed"),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio_util::sync::CancellationToken;

    /// collect_loop / digest_loop の中核パターン (tokio::select! + CancellationToken) を
    /// 独立して検証する。AppHandle / AppState の構築を避け、キャンセレーションの動作のみを確認。

    /// CancellationToken を即時キャンセルすると 1 秒以内にループが終了することを証明する。
    #[tokio::test]
    async fn test_cancellation_token_exits_loop_immediately() {
        let token = CancellationToken::new();
        let token_clone = token.clone();

        let handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = token_clone.cancelled() => {
                        break;
                    }
                    _ = tokio::time::sleep(Duration::from_secs(3600)) => {
                        // 本来 1 時間 sleep するが、cancel が優先される
                    }
                }
            }
        });

        // 即時キャンセル
        token.cancel();

        let result = tokio::time::timeout(Duration::from_secs(1), handle).await;
        assert!(result.is_ok(), "ループが 1 秒以内に終了しなかった");
        assert!(result.unwrap().is_ok(), "ループタスクがパニックした");
    }

    /// スリープ中にキャンセルが届いた場合も 1 秒以内に終了することを証明する。
    #[tokio::test]
    async fn test_cancellation_during_sleep_exits_promptly() {
        let token = CancellationToken::new();
        let token_clone = token.clone();

        let handle = tokio::spawn(async move {
            tokio::select! {
                _ = token_clone.cancelled() => "cancelled",
                _ = tokio::time::sleep(Duration::from_secs(60)) => "slept",
            }
        });

        // 少し待ってからキャンセル
        tokio::time::sleep(Duration::from_millis(50)).await;
        token.cancel();

        let result = tokio::time::timeout(Duration::from_secs(1), handle).await;
        assert!(result.is_ok(), "タスクが 1 秒以内に終了しなかった");
        assert_eq!(result.unwrap().unwrap(), "cancelled");
    }

    /// watch::channel の設定変更が sleep を割り込んで即座に反映されることを証明する。
    /// digest_loop が SchedulerConfig 変更で再スケジュールされる動作を模倣する。
    #[tokio::test]
    async fn test_config_change_interrupts_sleep() {
        let (config_tx, mut config_rx) = tokio::sync::watch::channel(SchedulerConfig {
            enabled: true,
            collect_interval_minutes: 60,
            digest_hour: 8,
            digest_minute: 0,
        });

        let handle = tokio::spawn(async move {
            tokio::select! {
                result = config_rx.changed() => {
                    if result.is_ok() { "config_changed" } else { "channel_closed" }
                }
                _ = tokio::time::sleep(Duration::from_secs(3600)) => "slept",
            }
        });

        // 少し待ってから設定更新
        tokio::time::sleep(Duration::from_millis(50)).await;
        config_tx
            .send(SchedulerConfig {
                enabled: false,
                collect_interval_minutes: 30,
                digest_hour: 8,
                digest_minute: 0,
            })
            .unwrap();

        let result = tokio::time::timeout(Duration::from_secs(1), handle).await;
        assert!(
            result.is_ok(),
            "設定変更後 1 秒以内にタスクが応答しなかった"
        );
        assert_eq!(result.unwrap().unwrap(), "config_changed");
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
