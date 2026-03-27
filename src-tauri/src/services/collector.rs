use crate::error::AppError;
use crate::models::Feed;
use crate::services::{dedup_service, feed_queries, scoring_service};
use sqlx::SqlitePool;
use std::sync::Arc;

use super::collectors::{AniListCollector, Collector, RssCollector, SteamCollector};

const FEED_SELECT: &str = "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes, \
     last_fetched_at, consecutive_errors, disabled_reason, last_error, \
     etag, last_modified, created_at, updated_at FROM feeds";

/// Refresh all enabled feeds. Called from the scheduler's `collect_loop`.
pub async fn refresh_all(db: &SqlitePool, http: &reqwest::Client) -> Result<u32, AppError> {
    let sql = format!("{FEED_SELECT} WHERE enabled = 1");
    let feeds: Vec<Feed> = sqlx::query_as::<_, Feed>(&sql).fetch_all(db).await?;

    let http = Arc::new(http.clone());
    let mut total = 0u32;

    for feed in &feeds {
        match collect_feed(db, &http, feed).await {
            Ok(count) => {
                total += count;
                tracing::info!(feed_id = feed.id, count, "Feed refreshed successfully");
            }
            Err(e) => {
                tracing::error!(feed_id = feed.id, error = %e, "Feed refresh failed");
                if let Err(e2) = feed_queries::update_feed_failure(db, feed.id, &e.to_string()).await {
                    tracing::warn!(feed_id = feed.id, error = %e2, "Failed to record feed failure");
                }
            }
        }
    }

    Ok(total)
}

pub async fn refresh_one(
    db: &SqlitePool,
    http: &Arc<reqwest::Client>,
    feed_id: i64,
) -> Result<u32, AppError> {
    let sql = format!("{FEED_SELECT} WHERE id = ?");
    let feed: Feed = sqlx::query_as::<_, Feed>(&sql)
        .bind(feed_id)
        .fetch_one(db)
        .await?;

    collect_feed(db, http, &feed).await
}

pub async fn collect_feed(
    db: &SqlitePool,
    http: &Arc<reqwest::Client>,
    feed: &Feed,
) -> Result<u32, AppError> {
    let collector: Box<dyn Collector> = match feed.feed_type.as_str() {
        "rss" | "reddit" => Box::new(RssCollector::new(http.clone())),
        "anilist" => Box::new(AniListCollector::new(http.clone())),
        "steam" => Box::new(SteamCollector::new(http.clone())),
        other => {
            return Err(AppError::InvalidInput(format!(
                "Unsupported feed type: {other}"
            )));
        }
    };

    let mut articles = collector.collect(feed).await?;

    for article in &mut articles {
        if let Some(url) = &article.url {
            article.url_normalized = Some(dedup_service::normalize_url(url));
        }
        if let Some(content) = &article.content {
            article.content_hash = Some(dedup_service::generate_content_hash(content));
        }
    }

    let existing = feed_queries::recent_articles_for_dedup(db, &feed.category).await?;
    for article in &mut articles {
        for existing_article in &existing {
            let similarity =
                dedup_service::jaccard_bigram_similarity(&article.title, &existing_article.title);
            if similarity >= 0.6 {
                article.is_duplicate = true;
                article.duplicate_of = Some(existing_article.id);
                break;
            }
            if let (Some(new_hash), Some(existing_hash)) =
                (&article.content_hash, &existing_article.content_hash)
                && new_hash == existing_hash
            {
                article.is_duplicate = true;
                article.duplicate_of = Some(existing_article.id);
                break;
            }
        }
    }

    for article in &mut articles {
        article.importance_score = scoring_service::calculate_importance(article, &feed.category);
    }

    let count = feed_queries::upsert_articles(db, &articles).await?;
    feed_queries::update_feed_success(db, feed.id, None, None).await?;

    Ok(count)
}
