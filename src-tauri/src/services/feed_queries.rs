use crate::error::AppError;
use crate::models::{ArticleDetailDto, Feed, FeedDto};
use sqlx::{Row, SqlitePool};

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

/// TODO: collector::refresh_all から呼び出される予定
#[allow(dead_code)]
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
    if errors >= 3 {
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

