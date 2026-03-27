use crate::error::AppError;
use crate::infra::{anilist_client, rss_fetcher, steam_client};
use crate::models::{Article, Feed};
use crate::parsers::rss_parser;
use async_trait::async_trait;
use chrono::Datelike;
use std::sync::Arc;

#[async_trait]
pub trait Collector: Send + Sync {
    async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError>;
}

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

        if let Some((raw, _new_cache)) =
            rss_fetcher::fetch_rss(&self.http, &feed.url, &cache).await?
        {
            rss_parser::parse_rss_feed(&raw, feed.id)
        } else {
            Ok(Vec::new())
        }
    }
}

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
            client
                .fetch_seasonal_anime(season, now.year(), Some(1))
                .await?
        };

        Ok(articles
            .into_iter()
            .map(|mut a| {
                a.feed_id = feed.id;
                a
            })
            .collect())
    }
}

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

        Ok(articles
            .into_iter()
            .map(|mut a| {
                a.feed_id = feed.id;
                a
            })
            .collect())
    }
}
