#![allow(dead_code)]
use crate::error::AppError;
use crate::models::{Article, ArticleDto};
use sqlx::SqlitePool;

pub async fn list_articles(
    db: &SqlitePool,
    category: Option<&str>,
) -> Result<Vec<ArticleDto>, AppError> {
    let rows: Vec<ArticleDto> = if let Some(cat) = category {
        sqlx::query_as::<_, ArticleDto>(
            "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author,
             a.published_at, a.importance_score, a.is_read, a.is_bookmarked,
             a.language, a.thumbnail_url, f.name as feed_name
             FROM articles a JOIN feeds f ON a.feed_id = f.id
             WHERE a.is_duplicate = 0 AND f.category = ?
             ORDER BY a.published_at DESC LIMIT 100",
        )
        .bind(cat)
        .fetch_all(db)
        .await?
    } else {
        sqlx::query_as::<_, ArticleDto>(
            "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author,
             a.published_at, a.importance_score, a.is_read, a.is_bookmarked,
             a.language, a.thumbnail_url, f.name as feed_name
             FROM articles a JOIN feeds f ON a.feed_id = f.id
             WHERE a.is_duplicate = 0
             ORDER BY a.published_at DESC LIMIT 100",
        )
        .fetch_all(db)
        .await?
    };

    Ok(rows)
}

pub async fn upsert_articles(db: &SqlitePool, articles: &[Article]) -> Result<u32, AppError> {
    if articles.is_empty() {
        return Ok(0);
    }

    let mut tx = db.begin().await?;
    let mut count = 0u32;

    for article in articles {
        let result = sqlx::query(
            "INSERT INTO articles (
                feed_id, external_id, title, url, url_normalized, content, summary,
                author, published_at, importance_score, language, thumbnail_url,
                content_hash, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(feed_id, external_id) DO UPDATE SET
                title = excluded.title,
                url = excluded.url,
                url_normalized = excluded.url_normalized,
                content = excluded.content,
                summary = excluded.summary,
                author = excluded.author,
                published_at = excluded.published_at,
                importance_score = excluded.importance_score,
                language = excluded.language,
                thumbnail_url = excluded.thumbnail_url,
                content_hash = excluded.content_hash,
                metadata = excluded.metadata
            WHERE 1=1",
        )
        .bind(article.feed_id)
        .bind(&article.external_id)
        .bind(&article.title)
        .bind(&article.url)
        .bind(&article.url_normalized)
        .bind(&article.content)
        .bind(&article.summary)
        .bind(&article.author)
        .bind(&article.published_at)
        .bind(article.importance_score)
        .bind(&article.language)
        .bind(&article.thumbnail_url)
        .bind(&article.content_hash)
        .bind(&article.metadata)
        .execute(&mut *tx)
        .await?;

        count += result.rows_affected() as u32;
    }

    tx.commit().await?;
    Ok(count)
}

pub async fn recent_articles_for_dedup(
    db: &SqlitePool,
    category: &str,
) -> Result<Vec<Article>, AppError> {
    let rows = sqlx::query_as::<_, Article>(
        "SELECT a.id, a.feed_id, a.external_id, a.title, a.url, a.url_normalized,
         a.content, a.summary, a.author, a.published_at, a.importance_score,
         a.is_read, a.is_bookmarked, a.is_duplicate, a.duplicate_of,
         a.language, a.thumbnail_url, a.content_hash, a.metadata, a.created_at
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE f.category = ? AND a.created_at >= datetime('now', '-7 days')
         ORDER BY a.created_at DESC",
    )
    .bind(category)
    .fetch_all(db)
    .await?;

    Ok(rows)
}

pub async fn mark_all_as_read(db: &SqlitePool, category: Option<&str>) -> Result<u32, AppError> {
    let result = if let Some(cat) = category {
        sqlx::query(
            "UPDATE articles SET is_read = 1
             WHERE is_read = 0 AND feed_id IN (SELECT id FROM feeds WHERE category = ?)",
        )
        .bind(cat)
        .execute(db)
        .await?
    } else {
        sqlx::query("UPDATE articles SET is_read = 1 WHERE is_read = 0")
            .execute(db)
            .await?
    };
    Ok(result.rows_affected() as u32)
}

pub async fn mark_as_read(db: &SqlitePool, article_id: i64) -> Result<(), AppError> {
    sqlx::query("UPDATE articles SET is_read = 1 WHERE id = ?")
        .bind(article_id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn toggle_bookmark(db: &SqlitePool, article_id: i64) -> Result<(), AppError> {
    sqlx::query("UPDATE articles SET is_bookmarked = NOT is_bookmarked WHERE id = ?")
        .bind(article_id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn record_interaction(
    db: &SqlitePool,
    article_id: i64,
    action: &str,
    dwell_seconds: i64,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO article_interactions (article_id, action, dwell_seconds)
         VALUES (?1, ?2, ?3)",
    )
    .bind(article_id)
    .bind(action)
    .bind(dwell_seconds)
    .execute(db)
    .await?;
    Ok(())
}

#[cfg(test)]
#[path = "article_queries_tests.rs"]
mod tests;
