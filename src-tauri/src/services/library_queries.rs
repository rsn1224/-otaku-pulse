use crate::error::AppError;
use crate::models::{DiscoverArticleDto, DiscoverFeedResult};
use sqlx::SqlitePool;

const DISCOVER_COLS: &str = "a.id, a.feed_id, a.title, a.url, a.summary, a.author, \
     a.published_at, a.is_read, a.is_bookmarked, a.language, \
     a.thumbnail_url, a.ai_summary, f.name AS feed_name, f.category AS category";

pub async fn get_library_articles(
    db: &SqlitePool,
    limit: i64,
    offset: i64,
) -> Result<DiscoverFeedResult, AppError> {
    let sql = format!(
        "SELECT {DISCOVER_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
         FROM articles a JOIN feeds f ON a.feed_id = f.id
         LEFT JOIN article_scores s ON a.id = s.article_id
         WHERE a.is_bookmarked = 1
         ORDER BY a.published_at DESC LIMIT ?1 OFFSET ?2"
    );
    let articles = sqlx::query_as::<_, DiscoverArticleDto>(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(db)
        .await?;

    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM articles WHERE is_bookmarked = 1")
        .fetch_one(db)
        .await?;

    let has_more = (offset + limit) < total.0;
    Ok(DiscoverFeedResult {
        articles,
        total: total.0,
        has_more,
    })
}
