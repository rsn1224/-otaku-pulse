use crate::error::AppError;
use crate::models::{ArticleDetailDto, ArticleDto, Feed, FeedDto};
use sqlx::{Row, SqlitePool};

const MAX_CONSECUTIVE_ERRORS: i64 = 3;
const DEFAULT_FETCH_INTERVAL_MINUTES: i64 = 60;

// Re-export article_queries for backward compatibility
pub use super::article_queries::{recent_articles_for_dedup, toggle_bookmark, upsert_articles};

pub async fn list_feeds(db: &SqlitePool) -> Result<Vec<FeedDto>, AppError> {
    let rows = sqlx::query_as::<_, Feed>(
        "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes,
         last_fetched_at, consecutive_errors, disabled_reason, last_error,
         etag, last_modified, created_at, updated_at
         FROM feeds ORDER BY category, name",
    )
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|f| FeedDto {
            id: f.id,
            name: f.name,
            url: f.url,
            feed_type: f.feed_type,
            category: f.category,
            enabled: f.enabled,
            fetch_interval_minutes: f.fetch_interval_minutes,
            last_fetched_at: f.last_fetched_at,
            consecutive_errors: f.consecutive_errors,
            disabled_reason: f.disabled_reason,
            last_error: f.last_error,
        })
        .collect())
}

pub async fn update_feed_success(
    db: &SqlitePool,
    feed_id: i64,
    etag: Option<&str>,
    last_modified: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE feeds SET
            consecutive_errors = 0, last_error = NULL,
            last_fetched_at = datetime('now'),
            etag = ?, last_modified = ?
         WHERE id = ?",
    )
    .bind(etag)
    .bind(last_modified)
    .bind(feed_id)
    .execute(db)
    .await?;

    Ok(())
}

/// Record a feed fetch failure. Called from `collector::refresh_all`.
pub async fn update_feed_failure(
    db: &SqlitePool,
    feed_id: i64,
    error_msg: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE feeds SET
            consecutive_errors = consecutive_errors + 1,
            last_error = ?
         WHERE id = ?",
    )
    .bind(error_msg)
    .bind(feed_id)
    .execute(db)
    .await?;

    let row = sqlx::query("SELECT consecutive_errors FROM feeds WHERE id = ?")
        .bind(feed_id)
        .fetch_one(db)
        .await?;

    let errors: i64 = row.get("consecutive_errors");
    if errors >= MAX_CONSECUTIVE_ERRORS {
        sqlx::query(
            "UPDATE feeds SET enabled = 0, disabled_reason = '3回連続エラーにより自動無効化' WHERE id = ?",
        )
        .bind(feed_id)
        .execute(db)
        .await?;
    }

    Ok(())
}

pub async fn reenable(db: &SqlitePool, feed_id: i64) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE feeds SET
            enabled = 1, consecutive_errors = 0,
            disabled_reason = NULL, last_error = NULL
         WHERE id = ?",
    )
    .bind(feed_id)
    .execute(db)
    .await?;

    Ok(())
}

pub async fn get_article_detail(
    db: &SqlitePool,
    article_id: i64,
) -> Result<ArticleDetailDto, AppError> {
    let row = sqlx::query(
        "SELECT a.id, a.title, a.url, a.content, a.summary, a.author,
         a.published_at, a.importance_score, f.name as feed_name
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.id = ?",
    )
    .bind(article_id)
    .fetch_one(db)
    .await?;

    Ok(ArticleDetailDto {
        id: row.get("id"),
        title: row.get("title"),
        url: row.get("url"),
        content: row.get("content"),
        summary: row.get("summary"),
        author: row.get("author"),
        published_at: row.get("published_at"),
        feed_name: row.get("feed_name"),
        importance_score: row.get("importance_score"),
    })
}

pub async fn get_all_feeds_for_export(db: &SqlitePool) -> Result<Vec<Feed>, AppError> {
    let feeds = sqlx::query_as::<_, Feed>(
        "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes,
         last_fetched_at, consecutive_errors, disabled_reason, last_error,
         etag, last_modified, created_at, updated_at
         FROM feeds ORDER BY category, name",
    )
    .fetch_all(db)
    .await?;

    Ok(feeds)
}

pub async fn import_feed_if_new(
    db: &SqlitePool,
    name: &str,
    url: &str,
    category: &str,
) -> Result<bool, AppError> {
    let existing = sqlx::query("SELECT id FROM feeds WHERE url = ?")
        .bind(url)
        .fetch_optional(db)
        .await?;

    if existing.is_none() {
        sqlx::query(
            "INSERT INTO feeds (name, url, feed_type, category, enabled, fetch_interval_minutes)
             VALUES (?, ?, 'rss', ?, 1, ?)",
        )
        .bind(name)
        .bind(url)
        .bind(category)
        .bind(DEFAULT_FETCH_INTERVAL_MINUTES)
        .execute(db)
        .await?;

        Ok(true)
    } else {
        Ok(false)
    }
}

pub async fn delete_feed(db: &SqlitePool, feed_id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM articles WHERE feed_id = ?")
        .bind(feed_id)
        .execute(db)
        .await?;

    sqlx::query("DELETE FROM feeds WHERE id = ?")
        .bind(feed_id)
        .execute(db)
        .await?;

    Ok(())
}

pub async fn cleanup_old_articles(db: &SqlitePool, cutoff_date: &str) -> Result<u32, AppError> {
    let result = sqlx::query(
        "DELETE FROM articles
         WHERE published_at < ?
         AND is_bookmarked = 0
         AND is_read = 1",
    )
    .bind(cutoff_date)
    .execute(db)
    .await?;

    Ok(result.rows_affected() as u32)
}

pub async fn get_bookmarked_articles(db: &SqlitePool) -> Result<Vec<ArticleDto>, AppError> {
    let articles = sqlx::query(
        "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author, a.published_at,
                a.is_read, a.is_bookmarked, a.language, a.thumbnail_url, a.importance_score,
                f.name as feed_name
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_bookmarked = 1
         ORDER BY a.created_at DESC",
    )
    .fetch_all(db)
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

pub async fn get_enabled_feeds(db: &SqlitePool) -> Result<Vec<Feed>, AppError> {
    let feeds = sqlx::query_as::<_, Feed>(
        "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes,
         last_fetched_at, consecutive_errors, disabled_reason, last_error,
         etag, last_modified, created_at, updated_at
         FROM feeds WHERE enabled = 1",
    )
    .fetch_all(db)
    .await?;

    Ok(feeds)
}

pub async fn insert_default_feed(
    db: &SqlitePool,
    name: &str,
    url: &str,
    feed_type: &str,
    category: &str,
) -> Result<bool, AppError> {
    let existing = sqlx::query("SELECT id FROM feeds WHERE url = ?")
        .bind(url)
        .fetch_optional(db)
        .await?;

    if existing.is_none() {
        sqlx::query(
            "INSERT INTO feeds (name, url, feed_type, category, enabled, fetch_interval_minutes)
             VALUES (?, ?, ?, ?, 1, ?)",
        )
        .bind(name)
        .bind(url)
        .bind(feed_type)
        .bind(category)
        .bind(DEFAULT_FETCH_INTERVAL_MINUTES)
        .execute(db)
        .await?;

        Ok(true)
    } else {
        Ok(false)
    }
}

pub async fn fix_feed_category(
    db: &SqlitePool,
    domain: &str,
    correct_category: &str,
) -> Result<u64, AppError> {
    let updated =
        sqlx::query("UPDATE feeds SET category = ?1 WHERE url LIKE ?2 AND category != ?1")
            .bind(correct_category)
            .bind(format!("%{}%", domain))
            .execute(db)
            .await?;

    Ok(updated.rows_affected())
}

