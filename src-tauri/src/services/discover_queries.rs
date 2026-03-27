use crate::error::AppError;
use crate::models::{DiscoverArticleDto, DiscoverFeedResult};
use sqlx::SqlitePool;

const PAGE_SIZE: i64 = 30;
const MAX_LIMIT: i64 = 200;

const DISCOVER_COLS: &str = "a.id, a.feed_id, a.title, a.url, a.summary, a.author, \
     a.published_at, a.is_read, a.is_bookmarked, a.language, \
     a.thumbnail_url, a.ai_summary, f.name AS feed_name, f.category AS category";

pub async fn get_discover_feed(
    db: &SqlitePool,
    tab: &str,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<DiscoverFeedResult, AppError> {
    let limit = limit.unwrap_or(PAGE_SIZE).clamp(1, MAX_LIMIT);
    let offset = offset.unwrap_or(0).max(0);

    let (articles, total) = match tab {
        "trending" => get_trending(db, limit, offset).await?,
        "popular" => get_popular(db, limit, offset).await?,
        "most_viewed" => get_most_viewed(db, limit, offset).await?,
        "anime" | "manga" | "game" | "pc" | "hardware" => {
            let cat = if tab == "hardware" { "pc" } else { tab };
            get_by_category(db, cat, limit, offset).await?
        }
        _ => get_for_you(db, limit, offset).await?,
    };

    let has_more = (offset + limit) < total;

    Ok(DiscoverFeedResult {
        articles,
        total,
        has_more,
    })
}

async fn get_for_you(
    db: &SqlitePool,
    limit: i64,
    offset: i64,
) -> Result<(Vec<DiscoverArticleDto>, i64), AppError> {
    let sql = format!(
        "SELECT {DISCOVER_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
         FROM articles a JOIN feeds f ON a.feed_id = f.id
         LEFT JOIN article_scores s ON a.id = s.article_id
         WHERE a.is_duplicate = 0
         ORDER BY total_score DESC, a.published_at DESC
         LIMIT ?1 OFFSET ?2"
    );
    let articles = sqlx::query_as::<_, DiscoverArticleDto>(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(db)
        .await?;
    Ok((articles, count_all(db).await?))
}

async fn get_trending(
    db: &SqlitePool,
    limit: i64,
    offset: i64,
) -> Result<(Vec<DiscoverArticleDto>, i64), AppError> {
    let sql = format!(
        "SELECT {DISCOVER_COLS},
                (COALESCE(s.total_score, a.importance_score)
                 + COALESCE(SUM(CASE WHEN ai.action = 'open' THEN 2.0
                     WHEN ai.action = 'bookmark' THEN 3.0
                     WHEN ai.action = 'deepdive' THEN 2.5 ELSE 0 END), 0)
                ) AS total_score
         FROM articles a JOIN feeds f ON a.feed_id = f.id
         LEFT JOIN article_scores s ON a.id = s.article_id
         LEFT JOIN article_interactions ai ON a.id = ai.article_id
         WHERE a.is_duplicate = 0 AND a.published_at >= datetime('now', '-12 hours')
         GROUP BY a.id ORDER BY total_score DESC, a.published_at DESC
         LIMIT ?1 OFFSET ?2"
    );
    let articles = sqlx::query_as::<_, DiscoverArticleDto>(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(db)
        .await?;

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM articles
         WHERE is_duplicate = 0 AND published_at >= datetime('now', '-12 hours')",
    )
    .fetch_one(db)
    .await?;

    Ok((articles, total.0))
}

async fn get_by_category(
    db: &SqlitePool,
    category: &str,
    limit: i64,
    offset: i64,
) -> Result<(Vec<DiscoverArticleDto>, i64), AppError> {
    let sql = format!(
        "SELECT {DISCOVER_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
         FROM articles a JOIN feeds f ON a.feed_id = f.id
         LEFT JOIN article_scores s ON a.id = s.article_id
         WHERE a.is_duplicate = 0 AND f.category = ?1
         ORDER BY total_score DESC, a.published_at DESC
         LIMIT ?2 OFFSET ?3"
    );
    let articles = sqlx::query_as::<_, DiscoverArticleDto>(&sql)
        .bind(category)
        .bind(limit)
        .bind(offset)
        .fetch_all(db)
        .await?;

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_duplicate = 0 AND f.category = ?1",
    )
    .bind(category)
    .fetch_one(db)
    .await?;

    Ok((articles, total.0))
}

async fn count_all(db: &SqlitePool) -> Result<i64, AppError> {
    let r: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM articles WHERE is_duplicate = 0")
        .fetch_one(db)
        .await?;
    Ok(r.0)
}

async fn get_popular(
    db: &SqlitePool,
    limit: i64,
    offset: i64,
) -> Result<(Vec<DiscoverArticleDto>, i64), AppError> {
    let sql = format!(
        "SELECT {DISCOVER_COLS},
                (COALESCE(s.total_score, a.importance_score) + COALESCE(ai.eng, 0)) AS total_score
         FROM articles a JOIN feeds f ON a.feed_id = f.id
         LEFT JOIN article_scores s ON a.id = s.article_id
         LEFT JOIN (SELECT article_id, SUM(CASE WHEN action='bookmark' THEN 3.0
             WHEN action='deepdive' THEN 2.5 WHEN action='open' THEN 1.0 ELSE 0 END) AS eng
             FROM article_interactions GROUP BY article_id) ai ON ai.article_id = a.id
         WHERE a.is_duplicate = 0
         ORDER BY total_score DESC, a.published_at DESC
         LIMIT ?1 OFFSET ?2"
    );
    let articles = sqlx::query_as::<_, DiscoverArticleDto>(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(db)
        .await?;
    Ok((articles, count_all(db).await?))
}

async fn get_most_viewed(
    db: &SqlitePool,
    limit: i64,
    offset: i64,
) -> Result<(Vec<DiscoverArticleDto>, i64), AppError> {
    let sql = format!(
        "SELECT {DISCOVER_COLS}, CAST(COALESCE(ai.vc, 0) AS REAL) AS total_score
         FROM articles a JOIN feeds f ON a.feed_id = f.id
         LEFT JOIN (SELECT article_id, COUNT(*) AS vc FROM article_interactions
             WHERE action = 'open' GROUP BY article_id) ai ON ai.article_id = a.id
         WHERE a.is_duplicate = 0
         ORDER BY COALESCE(ai.vc, 0) DESC, a.published_at DESC
         LIMIT ?1 OFFSET ?2"
    );
    let articles = sqlx::query_as::<_, DiscoverArticleDto>(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(db)
        .await?;
    Ok((articles, count_all(db).await?))
}

// ---------------------------------------------------------------------------
// Unread Counts / Bulk Read / Related Articles
// ---------------------------------------------------------------------------

pub async fn get_unread_counts(
    db: &SqlitePool,
) -> Result<(i64, i64, i64, i64, i64, i64), AppError> {
    let row: (i64, i64, i64, i64, i64, i64) = sqlx::query_as(
        "SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN a.published_at >= datetime('now', '-12 hours') THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'anime' THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'game' THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'manga' THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'pc' THEN 1 ELSE 0 END)
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_duplicate = 0 AND a.is_read = 0",
    )
    .fetch_one(db)
    .await?;
    Ok(row)
}

pub async fn mark_all_read_category(
    db: &SqlitePool,
    category: &str,
) -> Result<i64, AppError> {
    let result = if category == "for_you" || category == "all" {
        sqlx::query("UPDATE articles SET is_read = 1 WHERE is_read = 0")
            .execute(db)
            .await?
    } else if category == "trending" {
        sqlx::query(
            "UPDATE articles SET is_read = 1
             WHERE is_read = 0 AND published_at >= datetime('now', '-12 hours')",
        )
        .execute(db)
        .await?
    } else {
        let cat = if category == "hardware" {
            "pc"
        } else {
            category
        };
        sqlx::query(
            "UPDATE articles SET is_read = 1
             WHERE is_read = 0 AND feed_id IN (SELECT id FROM feeds WHERE category = ?1)",
        )
        .bind(cat)
        .execute(db)
        .await?
    };

    Ok(result.rows_affected() as i64)
}

pub async fn get_related_articles(
    db: &SqlitePool,
    article_id: i64,
) -> Result<Vec<DiscoverArticleDto>, AppError> {
    let articles = sqlx::query_as::<_, DiscoverArticleDto>(
        "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author,
                a.published_at, a.is_read, a.is_bookmarked, a.language,
                a.thumbnail_url, a.ai_summary,
                f.name AS feed_name, f.category AS category,
                a.importance_score AS total_score
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_duplicate = 0 AND a.id != ?1
           AND f.category = (SELECT f2.category FROM articles a2 JOIN feeds f2 ON a2.feed_id = f2.id WHERE a2.id = ?1)
         ORDER BY a.published_at DESC
         LIMIT 3",
    )
    .bind(article_id)
    .fetch_all(db)
    .await?;

    Ok(articles)
}

pub use super::article_queries::record_interaction;
pub use super::library_queries::get_library_articles;
