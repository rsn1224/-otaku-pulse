use chrono::{Local, Timelike};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, sleep};
use tracing::{info, warn};

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
pub fn start(
    app_handle: AppHandle,
    config: SchedulerConfig,
    db_pool: Arc<sqlx::SqlitePool>,
    http_client: Arc<reqwest::Client>,
) {
    let config_clone = config.clone();
    let app_handle_clone = app_handle.clone();

    // 収集ループ (tauri::async_runtime はsetup()内でも利用可能)
    tauri::async_runtime::spawn(async move {
        collect_loop(app_handle_clone, config_clone, db_pool, http_client).await;
    });

    // ダイジェストループ
    let app_handle_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        digest_loop(app_handle_clone, config).await;
    });
}

/// 収集ループ
async fn collect_loop(
    app_handle: AppHandle,
    config: SchedulerConfig,
    _db_pool: Arc<sqlx::SqlitePool>,
    _http_client: Arc<reqwest::Client>,
) {
    let mut interval_timer = interval(Duration::from_secs(config.collect_interval_minutes * 60));

    loop {
        interval_timer.tick().await;

        if !config.enabled {
            continue;
        }

        // STUB: フィード収集は commands/collect.rs の collect_feeds を直接呼ぶ形に統合予定
        info!("スケジューラ: フィード収集開始");

        let result = CollectResult {
            fetched: 0,
            saved: 0,
        };

        info!(
            fetched = result.fetched,
            saved = result.saved,
            "スケジューラ: フィード収集完了"
        );

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

/// ダイジェスト生成ループ
async fn digest_loop(app_handle: AppHandle, config: SchedulerConfig) {
    loop {
        // 次の digest_hour:digest_minute まで待機
        let wait = seconds_until(config.digest_hour, config.digest_minute);
        sleep(Duration::from_secs(wait)).await;

        if !config.enabled {
            continue;
        }

        info!("スケジューラ: ダイジェスト生成開始");

        // 4カテゴリーを順番に生成
        for category in &["anime", "manga", "game", "pc"] {
            // STUB: generate_llm_digest 統合予定（LLM プロバイダー設定後に実装）
            info!("ダイジェスト生成対象: {}", category);

            // STUB: 記事数は digest 生成結果から取得予定
            crate::infra::notification::notify_digest_ready(
                &app_handle,
                category,
                0,
            );
        }

        info!("スケジューラ: ダイジェスト生成完了");
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
