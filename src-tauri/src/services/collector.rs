use crate::error::AppError;
use crate::models::Feed;
use crate::services::{dedup_service, feed_queries, scoring_service};
use rayon::prelude::*;
use sqlx::{Row, SqlitePool};
use std::sync::Arc;

use super::collectors::{AniListCollector, Collector, RssCollector, SteamCollector};

const FEED_SELECT: &str = "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes, \
     last_fetched_at, consecutive_errors, disabled_reason, last_error, \
     etag, last_modified, created_at, updated_at FROM feeds";

/// Per-feed error details surfaced to the frontend.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedError {
    pub feed_id: i64,
    pub feed_name: String,
    pub error_message: String,
    pub consecutive_errors: i64,
}

/// Refresh all enabled feeds. Called from the scheduler's `collect_loop`.
///
/// Returns `(articles_saved, feeds_processed, per_feed_errors)`.
pub async fn refresh_all(
    db: &SqlitePool,
    http: &reqwest::Client,
) -> Result<(u32, u32, Vec<FeedError>), AppError> {
    let sql = format!("{FEED_SELECT} WHERE enabled = 1");
    let feeds: Vec<Feed> = sqlx::query_as::<_, Feed>(&sql).fetch_all(db).await?;

    let http = Arc::new(http.clone());
    let mut total = 0u32;
    let feeds_processed = feeds.len() as u32;
    let mut errors: Vec<FeedError> = Vec::new();

    for feed in &feeds {
        match collect_feed(db, &http, feed).await {
            Ok(count) => {
                total += count;
                tracing::info!(feed_id = feed.id, count, "Feed refreshed successfully");
            }
            Err(e) => {
                tracing::error!(feed_id = feed.id, error = %e, "Feed refresh failed");
                let mut consecutive = feed.consecutive_errors + 1;
                if let Err(e2) =
                    feed_queries::update_feed_failure(db, feed.id, &e.to_string()).await
                {
                    tracing::warn!(feed_id = feed.id, error = %e2, "Failed to record feed failure");
                } else {
                    // Read the updated consecutive_errors from DB
                    if let Ok(row) =
                        sqlx::query("SELECT consecutive_errors FROM feeds WHERE id = ?")
                            .bind(feed.id)
                            .fetch_one(db)
                            .await
                    {
                        consecutive = row.get("consecutive_errors");
                    }
                }
                errors.push(FeedError {
                    feed_id: feed.id,
                    feed_name: feed.name.clone(),
                    error_message: e.to_string(),
                    consecutive_errors: consecutive,
                });
            }
        }
    }

    Ok((total, feeds_processed, errors))
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

    // PERF-06: Parallelize URL normalization and content hashing for large feeds.
    // rayon thread-pool overhead is not worth it for small batches — serial path below threshold.
    const RAYON_THRESHOLD: usize = 50;
    if articles.len() >= RAYON_THRESHOLD {
        let normalized: Vec<(Option<String>, Option<String>)> = articles
            .par_iter()
            .map(|a| {
                let url_norm = a.url.as_deref().map(dedup_service::normalize_url);
                let hash = a.content.as_deref().map(dedup_service::generate_content_hash);
                (url_norm, hash)
            })
            .collect();
        for (article, (url_norm, hash)) in articles.iter_mut().zip(normalized) {
            article.url_normalized = url_norm;
            article.content_hash = hash;
        }
    } else {
        for article in &mut articles {
            if let Some(url) = &article.url {
                article.url_normalized = Some(dedup_service::normalize_url(url));
            }
            if let Some(content) = &article.content {
                article.content_hash = Some(dedup_service::generate_content_hash(content));
            }
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
