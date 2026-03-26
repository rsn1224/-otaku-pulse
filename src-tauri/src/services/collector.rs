#![allow(dead_code)]
use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use crate::error::AppError;
use crate::models::{Article, Feed};
use chrono::Datelike;
use crate::infra::{rss_fetcher, anilist_client, steam_client};
use crate::parsers::rss_parser;
use crate::services::{dedup_service, feed_queries, scoring_service};

#[async_trait]
pub trait Collector: Send + Sync {
    async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError>;
    #[allow(dead_code)]
    fn feed_type(&self) -> &str;
}

// ---------------------------------------------------------------------------
// RssCollector — RSS/Atom/Reddit フィード
// ---------------------------------------------------------------------------

pub struct RssCollector {
    http: Arc<reqwest::Client>,
}

impl RssCollector {
    pub fn new(http: Arc<reqwest::Client>) -> Self {
        Self { http }
    }
}

#[async_trait]
impl Collector for RssCollector {
    async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError> {
        let cache = rss_fetcher::FeedCache {
            etag: feed.etag.clone(),
            last_modified: feed.last_modified.clone(),
        };

        if let Some((raw, _new_cache)) = rss_fetcher::fetch_rss(&self.http, &feed.url, &cache).await? {
            rss_parser::parse_rss_feed(&raw, feed.id)
        } else {
            Ok(Vec::new())
        }
    }

    fn feed_type(&self) -> &str {
        "rss"
    }
}

// ---------------------------------------------------------------------------
// AniListCollector — AniList GraphQL API
// ---------------------------------------------------------------------------

pub struct AniListCollector {
    http: Arc<reqwest::Client>,
}

impl AniListCollector {
    pub fn new(http: Arc<reqwest::Client>) -> Self {
        Self { http }
    }
}

#[async_trait]
impl Collector for AniListCollector {
    async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError> {
        let client = anilist_client::AniListClient::new(self.http.clone());

        let is_manga = feed.category == "manga";
        // fetch_seasonal_anime / fetch_trending_manga は内部で graphql_parser を呼び、
        // 既に Vec<Article> を返す
        let articles = if is_manga {
            client.fetch_trending_manga(Some(1)).await?
        } else {
            let now = chrono::Utc::now();
            let season = match now.month() {
                1..=3 => "WINTER",
                4..=6 => "SPRING",
                7..=9 => "SUMMER",
                _ => "FALL",
            };
            client.fetch_seasonal_anime(season, now.year(), Some(1)).await?
        };

        Ok(articles.into_iter().map(|mut a| {
            a.feed_id = feed.id;
            a
        }).collect())
    }

    fn feed_type(&self) -> &str {
        "anilist"
    }
}

// ---------------------------------------------------------------------------
// SteamCollector — Steam News API
// ---------------------------------------------------------------------------

pub struct SteamCollector {
    http: Arc<reqwest::Client>,
}

impl SteamCollector {
    pub fn new(http: Arc<reqwest::Client>) -> Self {
        Self { http }
    }
}

#[async_trait]
impl Collector for SteamCollector {
    async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError> {
        let appid = steam_client::SteamClient::extract_appid(&feed.url)?;
        let client = steam_client::SteamClient::new(self.http.clone());
        let articles = client.fetch_app_news(appid).await?;

        Ok(articles.into_iter().map(|mut a| {
            a.feed_id = feed.id;
            a
        }).collect())
    }

    fn feed_type(&self) -> &str {
        "steam"
    }
}

// ---------------------------------------------------------------------------
// collect_feed — 収集 → dedup → UPSERT の統合フロー
// ---------------------------------------------------------------------------

/// 全フィードを収集して DB に保存。取得記事数を返す。
pub async fn refresh_all(
    db: &SqlitePool,
    http: &reqwest::Client,
) -> Result<u32, AppError> {
    let feeds: Vec<Feed> = sqlx::query_as::<_, Feed>(
        "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes,
         last_fetched_at, consecutive_errors, disabled_reason, last_error,
         etag, last_modified, created_at, updated_at
         FROM feeds WHERE enabled = 1"
    )
    .fetch_all(db)
    .await?;

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
                let _ = feed_queries::update_feed_failure(db, feed.id, &e.to_string()).await;
            }
        }
    }

    Ok(total)
}

/// 指定フィードのみ収集
pub async fn refresh_one(
    db: &SqlitePool,
    http: &Arc<reqwest::Client>,
    feed_id: i64,
) -> Result<u32, AppError> {
    let feed: Feed = sqlx::query_as::<_, Feed>(
        "SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes,
         last_fetched_at, consecutive_errors, disabled_reason, last_error,
         etag, last_modified, created_at, updated_at
         FROM feeds WHERE id = ?"
    )
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
    // C1 修正: 全 feed_type をサポート
    let collector: Box<dyn Collector> = match feed.feed_type.as_str() {
        "rss" | "reddit" => Box::new(RssCollector::new(http.clone())),
        "anilist" => Box::new(AniListCollector::new(http.clone())),
        "steam" => Box::new(SteamCollector::new(http.clone())),
        other => return Err(AppError::InvalidInput(format!("Unsupported feed type: {other}"))),
    };

    let mut articles = collector.collect(feed).await?;

    // Layer 1: URL 正規化 + Layer 3: content_hash 設定
    for article in &mut articles {
        if let Some(url) = &article.url {
            article.url_normalized = Some(dedup_service::normalize_url(url));
        }
        if let Some(content) = &article.content {
            article.content_hash = Some(dedup_service::generate_content_hash(content));
        }
    }

    // C2 修正: Layer 2 — Jaccard bigram で重複判定
    let existing = feed_queries::recent_articles_for_dedup(db, &feed.category).await?;
    for article in &mut articles {
        for existing_article in &existing {
            let similarity = dedup_service::jaccard_bigram_similarity(
                &article.title,
                &existing_article.title,
            );
            if similarity >= 0.6 {
                article.is_duplicate = true;
                article.duplicate_of = Some(existing_article.id);
                break;
            }
            // Layer 3: content_hash 完全一致
            if let (Some(new_hash), Some(existing_hash)) = (&article.content_hash, &existing_article.content_hash)
                && new_hash == existing_hash {
                article.is_duplicate = true;
                article.duplicate_of = Some(existing_article.id);
                break;
            }
        }
    }

    // scoring_serviceとの統合: UPSERTの前に重要度スコアを計算
    for article in &mut articles {
        article.importance_score = scoring_service::calculate_importance(article, &feed.category);
    }

    let count = feed_queries::upsert_articles(db, &articles).await?;
    feed_queries::update_feed_success(db, feed.id, None, None).await?;

    Ok(count)
}
