use crate::error::CmdResult;
use crate::models::Feed;
use crate::services::collector;
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

    let feeds = sqlx::query_as::<_, Feed>(
        "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes,
         last_fetched_at, consecutive_errors, disabled_reason, last_error,
         etag, last_modified, created_at, updated_at
         FROM feeds WHERE enabled = 1",
    )
    .fetch_all(&*db)
    .await
    .map_err(crate::error::AppError::Database)?;

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
        let existing = sqlx::query("SELECT id FROM feeds WHERE url = ?")
            .bind(url)
            .fetch_optional(&*db)
            .await?;

        if existing.is_none() {
            sqlx::query(
                "INSERT INTO feeds (name, url, feed_type, category, enabled, fetch_interval_minutes)
                 VALUES (?, ?, ?, ?, 1, 60)",
            )
            .bind(name)
            .bind(url)
            .bind(feed_type)
            .bind(category)
            .execute(&*db)
            .await?;

            added += 1;
            tracing::info!("Added default feed: {} ({})", name, url);
        }
    }

    tracing::info!("Initialized {} default feeds", added);

    for &(domain, correct_category) in CATEGORY_CORRECTIONS {
        let updated =
            sqlx::query("UPDATE feeds SET category = ?1 WHERE url LIKE ?2 AND category != ?1")
                .bind(correct_category)
                .bind(format!("%{}%", domain))
                .execute(&*db)
                .await?;

        if updated.rows_affected() > 0 {
            tracing::info!(
                "Fixed category for feeds matching '{}' -> '{}' ({} updated)",
                domain,
                correct_category,
                updated.rows_affected()
            );
        }
    }

    Ok(added)
}
