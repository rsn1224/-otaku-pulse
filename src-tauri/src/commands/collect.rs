use crate::error::CmdResult;
use crate::services::{collector, feed_queries};
use crate::state::{AppState, CollectLock};
use serde::Serialize;
use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::State;

use super::default_feeds::{CATEGORY_CORRECTIONS, DEFAULT_FEEDS};

#[derive(Serialize)]
pub struct CollectResult {
    pub fetched: usize,
    pub saved: usize,
    pub deduped: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn run_collect_now(
    db: State<'_, SqlitePool>,
    http: State<'_, Arc<reqwest::Client>>,
    collect_lock: State<'_, CollectLock>,
    state: State<'_, AppState>,
) -> CmdResult<CollectResult> {
    // 収集が既に進行中なら二重起動を避けてスキップする
    // (起動時の React StrictMode 二重実行 / scheduler との競合対策)
    let _guard = match collect_lock.0.try_lock() {
        Ok(guard) => guard,
        Err(_) => {
            tracing::info!("run_collect_now: 収集が既に進行中のためスキップ");
            return Ok(CollectResult {
                fetched: 0,
                saved: 0,
                deduped: 0,
                errors: Vec::new(),
            });
        }
    };

    // P1-4: 収集本体は collector::refresh_all に委譲し bounded 並列で実行する。
    // これにより起動時/手動収集も並列化され、feed 単位の失敗記録 (連続エラーで自動無効化) も
    // scheduler 経路と共通になる。collect_lock は本コマンド側で保持して二重起動を防ぐ。
    // 手動/起動時収集は全有効フィードを強制収集する (due_only = false)。
    let (saved, processed, feed_errors) = collector::refresh_all(&db, &http, false).await?;

    let errors: Vec<String> = feed_errors
        .into_iter()
        .map(|e| format!("Feed {} failed: {}", e.feed_name, e.error_message))
        .collect();

    tracing::info!(
        "Collection completed: feeds={}, saved={}, errors={}",
        processed,
        saved,
        errors.len()
    );

    // 収集後に AI サーフェシング (highlights / today_view / summary / context_memo) を
    // バックグラウンドで事前生成し、ロード時の LLM 同期待ちを解消する。本コマンドは待たずに返す。
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn(async move {
        crate::services::scheduler::precompute_surfacing(&app_state).await;
    });

    Ok(CollectResult {
        fetched: saved as usize,
        saved: saved as usize,
        deduped: 0,
        errors,
    })
}

#[tauri::command]
pub async fn init_default_feeds(db: State<'_, SqlitePool>) -> CmdResult<u32> {
    let mut added = 0u32;

    for &(name, url, category, feed_type) in DEFAULT_FEEDS {
        if feed_queries::insert_default_feed(&db, name, url, feed_type, category).await? {
            added += 1;
            tracing::info!("Added default feed: {} ({})", name, url);
        }
    }

    tracing::info!("Initialized {} default feeds", added);

    for &(domain, correct_category) in CATEGORY_CORRECTIONS {
        let updated = feed_queries::fix_feed_category(&db, domain, correct_category).await?;

        if updated > 0 {
            tracing::info!(
                "Fixed category for feeds matching '{}' -> '{}' ({} updated)",
                domain,
                correct_category,
                updated
            );
        }
    }

    Ok(added)
}
