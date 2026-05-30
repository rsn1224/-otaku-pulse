use crate::error::AppError;
use crate::models::{Article, Feed};
use crate::services::{dedup_service, feed_queries, scoring_service};
use rayon::prelude::*;
use sqlx::{Row, SqlitePool};
use std::sync::Arc;

use super::collectors::FeedType;

const FEED_SELECT: &str = "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes, \
     last_fetched_at, consecutive_errors, disabled_reason, last_error, \
     etag, last_modified, config, created_at, updated_at FROM feeds";

/// Per-feed error details surfaced to the frontend.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedError {
    pub feed_id: i64,
    pub feed_name: String,
    pub error_message: String,
    pub consecutive_errors: i64,
}

/// 収集の同時実行上限 (P1-4)。フィードを bounded 並列で収集して壁時間を短縮する。
/// AniList collector は per-instance TokenBucket でレート保護されており、AniList feed は
/// 少数のため同時実行でも 30 req/min を超えない。書き込み競合は busy_timeout で吸収する。
const REFRESH_CONCURRENCY: usize = 4;

/// Refresh enabled feeds in bounded parallel.
///
/// `due_only = true`: per-feed interval が経過したフィードのみ (scheduler の定期 tick 用)。
/// `due_only = false`: 全有効フィードを強制収集 (手動/起動時用)。
///
/// Returns `(articles_saved, feeds_processed, per_feed_errors)`.
pub async fn refresh_all(
    db: &SqlitePool,
    http: &reqwest::Client,
    due_only: bool,
) -> Result<(u32, u32, Vec<FeedError>), AppError> {
    let feeds = if due_only {
        feed_queries::get_due_feeds(db).await?
    } else {
        feed_queries::get_enabled_feeds(db).await?
    };
    let feeds_processed = feeds.len() as u32;

    let http = Arc::new(http.clone());
    let semaphore = Arc::new(tokio::sync::Semaphore::new(REFRESH_CONCURRENCY));
    let mut set: tokio::task::JoinSet<(Feed, Result<u32, AppError>)> = tokio::task::JoinSet::new();

    for feed in feeds {
        let db = db.clone();
        let http = http.clone();
        let semaphore = semaphore.clone();
        set.spawn(async move {
            // permit を保持している間だけ collect_feed が走り、同時実行数を制限する。
            let _permit = semaphore.acquire_owned().await;
            let mut result = collect_feed(&db, &http, &feed).await;
            // 並列収集では WAL の書き込み競合 (SQLITE_BUSY / BUSY_SNAPSHOT) が稀に起きる。
            // busy_timeout では拾えないため、短時間待って 1 回だけ再試行する (etag で再フェッチは軽い)。
            // 判定は AppError::is_sqlite_busy (型 + result code) で行い、メッセージ文字列に依存しない。
            if let Err(e) = &result
                && e.is_sqlite_busy()
            {
                tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                result = collect_feed(&db, &http, &feed).await;
            }
            (feed, result)
        });
    }

    let mut total = 0u32;
    let mut errors: Vec<FeedError> = Vec::new();

    while let Some(joined) = set.join_next().await {
        let (feed, result) = match joined {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(error = %e, "Feed collection task join error");
                continue;
            }
        };

        match result {
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
                } else if let Ok(row) =
                    sqlx::query("SELECT consecutive_errors FROM feeds WHERE id = ?")
                        .bind(feed.id)
                        .fetch_one(db)
                        .await
                {
                    consecutive = row.get("consecutive_errors");
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
    let collector = FeedType::parse(&feed.feed_type)?.make_collector(http.clone());

    let mut articles = collector.collect(feed).await?;

    // PERF-06: Parallelize URL normalization and content hashing for large feeds.
    // rayon thread-pool overhead is not worth it for small batches — serial path below threshold.
    const RAYON_THRESHOLD: usize = 50;
    if articles.len() >= RAYON_THRESHOLD {
        let normalized: Vec<(Option<String>, Option<String>)> = articles
            .par_iter()
            .map(|a| {
                let url_norm = a.url.as_deref().map(dedup_service::normalize_url);
                let hash = a
                    .content
                    .as_deref()
                    .map(dedup_service::generate_content_hash);
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
    // PERF (P1-5): 各記事は existing に対して独立に判定するため記事方向に並列化できる。
    // 小バッチは逐次 (rayon thread-pool オーバーヘッド回避、PERF-06 と同方針)。
    if articles.len() >= RAYON_THRESHOLD {
        articles
            .par_iter_mut()
            .for_each(|article| mark_duplicate(article, &existing));
    } else {
        for article in &mut articles {
            mark_duplicate(article, &existing);
        }
    }

    for article in &mut articles {
        article.importance_score = scoring_service::calculate_importance(article, &feed.category);
    }

    let count = feed_queries::upsert_articles(db, &articles).await?;
    feed_queries::update_feed_success(db, feed.id, None, None).await?;

    Ok(count)
}

/// 1 記事を既存記事群と突き合わせ、タイトル類似 (jaccard ≥ 0.6) または content_hash 一致なら
/// 重複としてマークする。`existing` は不変参照のみのため rayon で記事方向に並列実行できる。
fn mark_duplicate(article: &mut Article, existing: &[Article]) {
    for existing_article in existing {
        let similarity =
            dedup_service::jaccard_bigram_similarity(&article.title, &existing_article.title);
        if similarity >= 0.6 {
            article.is_duplicate = true;
            article.duplicate_of = Some(existing_article.id);
            return;
        }
        if let (Some(new_hash), Some(existing_hash)) =
            (&article.content_hash, &existing_article.content_hash)
            && new_hash == existing_hash
        {
            article.is_duplicate = true;
            article.duplicate_of = Some(existing_article.id);
            return;
        }
    }
}
