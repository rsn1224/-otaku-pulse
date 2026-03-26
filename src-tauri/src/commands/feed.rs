use crate::error::CmdResult;
use crate::models::{ArticleDetailDto, ArticleDto, FeedDto};
use crate::services::{collector, feed_queries, opml_service};
use sqlx::{Row, SqlitePool};
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
    let feeds = sqlx::query_as::<_, crate::models::Feed>(
        "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes,
         last_fetched_at, consecutive_errors, disabled_reason, last_error,
         etag, last_modified, created_at, updated_at
         FROM feeds ORDER BY category, name",
    )
    .fetch_all(&*db)
    .await?;

    Ok(opml_service::export_opml(&feeds))
}

#[tauri::command]
pub async fn import_opml(db: State<'_, SqlitePool>, xml: String) -> CmdResult<u32> {
    let feeds = opml_service::parse_opml(&xml)?;
    let mut imported_count = 0u32;

    for (name, url, category) in feeds {
        let existing = sqlx::query("SELECT id FROM feeds WHERE url = ?")
            .bind(&url)
            .fetch_optional(&*db)
            .await?;

        if existing.is_none() {
            sqlx::query(
                "INSERT INTO feeds (name, url, feed_type, category, enabled, fetch_interval_minutes)
                 VALUES (?, ?, 'rss', ?, 1, 60)",
            )
            .bind(&name)
            .bind(&url)
            .bind(&category)
            .execute(&*db)
            .await?;

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
    sqlx::query("DELETE FROM articles WHERE feed_id = ?")
        .bind(feed_id)
        .execute(&*db)
        .await?;

    sqlx::query("DELETE FROM feeds WHERE id = ?")
        .bind(feed_id)
        .execute(&*db)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn cleanup_old_articles(db: State<'_, SqlitePool>, days_old: i64) -> CmdResult<u32> {
    let cutoff_date = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(days_old))
        .ok_or(crate::error::AppError::Internal(
            "date calculation failed".into(),
        ))?
        .to_rfc3339();

    let result = sqlx::query(
        "DELETE FROM articles
         WHERE published_at < ?
         AND is_bookmarked = 0
         AND is_read = 1",
    )
    .bind(&cutoff_date)
    .execute(&*db)
    .await?;

    Ok(result.rows_affected() as u32)
}

#[tauri::command]
pub async fn get_bookmarked_articles(db: State<'_, SqlitePool>) -> CmdResult<Vec<ArticleDto>> {
    let articles = sqlx::query(
        "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author, a.published_at,
                a.is_read, a.is_bookmarked, a.language, a.thumbnail_url, a.importance_score,
                f.name as feed_name
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_bookmarked = 1
         ORDER BY a.created_at DESC",
    )
    .fetch_all(&*db)
    .await?;

    let dtos = articles
        .into_iter()
        .map(|row| ArticleDto {
            id: row.get("id"),
            feed_id: row.get("feed_id"),
            title: row.get("title"),
            url: row.get("url"),
            summary: row.get("summary"),
            author: row.get("author"),
            published_at: row.get("published_at"),
            is_read: row.get("is_read"),
            is_bookmarked: row.get("is_bookmarked"),
            language: row.get("language"),
            thumbnail_url: row.get("thumbnail_url"),
            importance_score: row.get("importance_score"),
            feed_name: row.get("feed_name"),
        })
        .collect();

    Ok(dtos)
}
