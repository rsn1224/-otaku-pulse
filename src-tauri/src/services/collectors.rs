use crate::error::AppError;
use crate::infra::{anilist_client, rss_fetcher, scraper_fetcher, steam_client};
use crate::models::{Article, Feed};
use crate::parsers::rss_parser;
use async_trait::async_trait;
use chrono::Datelike;
use std::sync::Arc;

#[async_trait]
pub trait Collector: Send + Sync {
    async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError>;
}

/// 収集ソース種別の SSOT。DB の `feeds.feed_type` 文字列・Collector・config 検証を
/// 一元的に対応付ける。新しいソースを追加する際はここと migration の CHECK 制約のみを触る
/// (両者の一致は `feed_type_matches_db_check` テストで検証する)。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeedType {
    Rss,
    Reddit,
    AniList,
    Steam,
    Scraper,
    CustomApi,
}

impl FeedType {
    /// DB CHECK 制約と一致させる全変種。
    pub const ALL: [FeedType; 6] = [
        FeedType::Rss,
        FeedType::Reddit,
        FeedType::AniList,
        FeedType::Steam,
        FeedType::Scraper,
        FeedType::CustomApi,
    ];

    /// DB に保存する文字列表現。
    pub fn as_str(self) -> &'static str {
        match self {
            FeedType::Rss => "rss",
            FeedType::Reddit => "reddit",
            FeedType::AniList => "anilist",
            FeedType::Steam => "steam",
            FeedType::Scraper => "scraper",
            FeedType::CustomApi => "custom-api",
        }
    }

    /// DB 文字列から `FeedType` を解決する。未対応値は `InvalidInput`。
    pub fn parse(s: &str) -> Result<Self, AppError> {
        Self::ALL
            .into_iter()
            .find(|ft| ft.as_str() == s)
            .ok_or_else(|| AppError::InvalidInput(format!("未対応の feed_type: {s}")))
    }

    /// feed_type に応じた config JSON のスキーマを検証する。
    /// collect 時 (`parse_source_config`) と追加時 (`add_custom_feed`) で同一の serde 型を使う。
    pub fn validate_config(self, config: Option<&str>) -> Result<(), AppError> {
        match self {
            FeedType::Scraper => {
                serde_json::from_str::<scraper_fetcher::ScrapeConfig>(self.require_config(config)?)
                    .map(|_| ())
                    .map_err(|e| AppError::InvalidInput(format!("scraper config が不正: {e}")))
            }
            FeedType::CustomApi => {
                serde_json::from_str::<scraper_fetcher::ApiConfig>(self.require_config(config)?)
                    .map(|_| ())
                    .map_err(|e| AppError::InvalidInput(format!("custom-api config が不正: {e}")))
            }
            _ => Ok(()),
        }
    }

    /// config 必須種別で非空文字列を取り出す。空・未設定は `InvalidInput`。
    fn require_config(self, config: Option<&str>) -> Result<&str, AppError> {
        config
            .map(str::trim)
            .filter(|c| !c.is_empty())
            .ok_or_else(|| {
                AppError::InvalidInput(format!("{} ソースには config が必要です", self.as_str()))
            })
    }

    /// この feed_type に対応する `Collector` を構築する。
    pub fn make_collector(self, http: Arc<reqwest::Client>) -> Box<dyn Collector> {
        match self {
            FeedType::Rss | FeedType::Reddit => Box::new(RssCollector::new(http)),
            FeedType::AniList => Box::new(AniListCollector::new(http)),
            FeedType::Steam => Box::new(SteamCollector::new(http)),
            FeedType::Scraper => Box::new(ScraperCollector::new(http)),
            FeedType::CustomApi => Box::new(CustomApiCollector::new(http)),
        }
    }
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

/// AniList の 1 ページ件数 (GraphQL の perPage)。これ未満なら最終ページと判断する。
const ANILIST_PER_PAGE: usize = 50;
/// 収集網羅性のためのページング上限 (50 件 × 3 = 最大 150 件)。
const MAX_ANILIST_PAGES: i32 = 3;

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
        let now = chrono::Utc::now();
        let season = match now.month() {
            1..=3 => "WINTER",
            4..=6 => "SPRING",
            7..=9 => "SUMMER",
            _ => "FALL",
        };

        // ページを順に取得 (グローバル限界器が 2.1s 間隔を保証)。
        // 50 件未満 (= 最終ページ) または空で打ち切る。
        let mut all = Vec::new();
        for page in 1..=MAX_ANILIST_PAGES {
            let batch = if is_manga {
                client.fetch_trending_manga(Some(page)).await?
            } else {
                client
                    .fetch_seasonal_anime(season, now.year(), Some(page))
                    .await?
            };
            let got = batch.len();
            all.extend(batch);
            if got < ANILIST_PER_PAGE {
                break;
            }
        }

        Ok(all
            .into_iter()
            .map(|mut a| {
                a.feed_id = feed.id;
                a
            })
            .collect())
    }
}

/// 任意 HTML スクレイピングコレクター (機能B)。
/// `feeds.config` の JSON を `ScrapeConfig` として解釈し、feed.url を取得して抽出する。
pub struct ScraperCollector {
    http: Arc<reqwest::Client>,
}

impl ScraperCollector {
    pub fn new(http: Arc<reqwest::Client>) -> Self {
        Self { http }
    }
}

#[async_trait]
impl Collector for ScraperCollector {
    async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError> {
        let cfg = parse_source_config::<scraper_fetcher::ScrapeConfig>(feed)?;
        let html = scraper_fetcher::fetch_text(&self.http, &feed.url).await?;
        scraper_fetcher::scrape_html(&html, feed.id, &cfg)
    }
}

/// 任意 JSON API コレクター (機能B)。
/// `feeds.config` を `ApiConfig` として解釈し、feed.url の JSON を field マッピングで抽出する。
pub struct CustomApiCollector {
    http: Arc<reqwest::Client>,
}

impl CustomApiCollector {
    pub fn new(http: Arc<reqwest::Client>) -> Self {
        Self { http }
    }
}

#[async_trait]
impl Collector for CustomApiCollector {
    async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError> {
        let cfg = parse_source_config::<scraper_fetcher::ApiConfig>(feed)?;
        let body = scraper_fetcher::fetch_text(&self.http, &feed.url).await?;
        scraper_fetcher::parse_api_json(&body, feed.id, &cfg)
    }
}

/// `feeds.config` の JSON を指定の設定型にデシリアライズする。
fn parse_source_config<T: serde::de::DeserializeOwned>(feed: &Feed) -> Result<T, AppError> {
    let raw = feed.config.as_deref().ok_or_else(|| {
        AppError::InvalidInput(format!(
            "ソース '{}' に config が設定されていません",
            feed.name
        ))
    })?;
    serde_json::from_str::<T>(raw).map_err(|e| {
        AppError::InvalidInput(format!("ソース '{}' の config JSON が不正: {e}", feed.name))
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    /// `FeedType::ALL` の文字列集合が migration の feeds.feed_type CHECK 制約と一致することを保証する。
    /// CHECK 側を変えたらこの期待値も更新すること (SSOT のドリフト検出)。
    #[test]
    fn feed_type_matches_db_check() {
        let mut actual: Vec<&str> = FeedType::ALL.iter().map(|ft| ft.as_str()).collect();
        actual.sort_unstable();
        let mut expected = vec!["anilist", "custom-api", "reddit", "rss", "scraper", "steam"];
        expected.sort_unstable();
        assert_eq!(
            actual, expected,
            "FeedType と DB CHECK 制約がドリフトしています"
        );
    }

    #[test]
    fn parse_rejects_removed_pc_state() {
        assert!(FeedType::parse("pc-state").is_err());
        assert_eq!(FeedType::parse("rss").unwrap(), FeedType::Rss);
        assert_eq!(FeedType::parse("custom-api").unwrap(), FeedType::CustomApi);
    }

    #[test]
    fn validate_config_requires_config_for_scraper() {
        assert!(FeedType::Scraper.validate_config(None).is_err());
        assert!(FeedType::Scraper.validate_config(Some("   ")).is_err());
        assert!(
            FeedType::Scraper
                .validate_config(Some("{not json"))
                .is_err()
        );
        assert!(
            FeedType::Scraper
                .validate_config(Some(r#"{"item":".p","title":"h2"}"#))
                .is_ok()
        );
        // config 不要種別は None でも OK
        assert!(FeedType::Rss.validate_config(None).is_ok());
    }
}
