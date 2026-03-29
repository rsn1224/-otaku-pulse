use crate::error::CmdResult;
use crate::models::{ArticleDetailDto, ArticleDto, FeedDto};
use crate::services::{collector, feed_queries, opml_service};
use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn refresh_feed(
    db: State<'_, SqlitePool>,
    http: State<'_, Arc<reqwest::Client>>,
    feed_id: i64,
) -> CmdResult<u32> {
    collector::refresh_one(&db, &http, feed_id).await
}

#[tauri::command]
pub async fn get_feeds(db: State<'_, SqlitePool>) -> CmdResult<Vec<FeedDto>> {
    feed_queries::list_feeds(&db).await
}

#[tauri::command]
pub async fn reenable_feed(db: State<'_, SqlitePool>, feed_id: i64) -> CmdResult<()> {
    feed_queries::reenable(&db, feed_id).await
}

#[tauri::command]
pub async fn toggle_bookmark(db: State<'_, SqlitePool>, article_id: i64) -> CmdResult<()> {
    feed_queries::toggle_bookmark(&db, article_id).await
}

#[tauri::command]
pub async fn export_opml(db: State<'_, SqlitePool>) -> CmdResult<String> {
    let feeds = feed_queries::get_all_feeds_for_export(&db).await?;
    Ok(opml_service::export_opml(&feeds))
}

#[tauri::command]
pub async fn import_opml(db: State<'_, SqlitePool>, xml: String) -> CmdResult<u32> {
    let feeds = opml_service::parse_opml(&xml)?;
    let mut imported_count = 0u32;

    for (name, url, category) in feeds {
        if feed_queries::import_feed_if_new(&db, &name, &url, &category).await? {
            imported_count += 1;
        }
    }

    Ok(imported_count)
}

#[tauri::command]
pub async fn get_article_detail(
    db: State<'_, SqlitePool>,
    article_id: i64,
) -> CmdResult<ArticleDetailDto> {
    feed_queries::get_article_detail(&db, article_id).await
}

#[tauri::command]
pub async fn delete_feed(db: State<'_, SqlitePool>, feed_id: i64) -> CmdResult<()> {
    feed_queries::delete_feed(&db, feed_id).await
}

#[tauri::command]
pub async fn cleanup_old_articles(db: State<'_, SqlitePool>, days_old: i64) -> CmdResult<u32> {
    let cutoff_date = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(days_old))
        .ok_or(crate::error::AppError::Internal(
            "date calculation failed".into(),
        ))?
        .to_rfc3339();

    feed_queries::cleanup_old_articles(&db, &cutoff_date).await
}

#[tauri::command]
pub async fn get_bookmarked_articles(db: State<'_, SqlitePool>) -> CmdResult<Vec<ArticleDto>> {
    feed_queries::get_bookmarked_articles(&db).await
}
