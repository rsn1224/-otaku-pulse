use crate::error::CmdResult;
use crate::services::{collector, feed_queries};
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
) -> CmdResult<CollectResult> {
    let mut errors = Vec::new();
    let mut fetched = 0;
    let mut saved = 0;

    let feeds = feed_queries::get_enabled_feeds(&db).await?;

    tracing::info!("Starting collection for {} feeds", feeds.len());

    for feed in &feeds {
        tracing::info!("Collecting from feed: {} ({})", feed.name, feed.feed_type);
        match collector::collect_feed(&db, &http, feed).await {
            Ok(count) => {
                fetched += count as usize;
                saved += count as usize;
                tracing::info!("Feed {} completed: collected={}", feed.name, count);
            }
            Err(e) => {
                let error_msg = format!("Feed {} failed: {}", feed.name, e);
                errors.push(error_msg.clone());
                tracing::error!("{}", error_msg);
            }
        }
    }

    tracing::info!(
        "Collection completed: fetched={}, saved={}, errors={}",
        fetched,
        saved,
        errors.len()
    );

    Ok(CollectResult {
        fetched,
        saved,
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
