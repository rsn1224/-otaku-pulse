use crate::error::AppError;
use crate::infra::rate_limiter::TokenBucket;
use crate::parsers::graphql_parser;
use reqwest::Client;
use serde_json::{Value, json};
use std::sync::{Arc, LazyLock};

const ANILIST_API_URL: &str = "https://graphql.anilist.co";

/// AniList のレート制限は **プロセス全体で共有** する (30 req/min, ≥2.1s 間隔)。
/// per-instance だと並列収集中の anime/manga feed やページングが各自の上限で動き、
/// 合算で 30 req/min を超えて 429 を招く。単一の静的 TokenBucket で全 AniList 要求を律速する。
/// (TokenBucket は min_interval=2100ms を内包し、2.1s 間隔も保証する)
static ANILIST_LIMITER: LazyLock<TokenBucket> =
    LazyLock::new(crate::infra::rate_limiter::configs::anilist);

pub struct AniListClient {
    client: Arc<Client>,
}

impl AniListClient {
    pub fn new(client: Arc<Client>) -> Self {
        Self { client }
    }

    /// Execute GraphQL query with rate limiting
    async fn execute_query(&self, query: &str, variables: Value) -> Result<String, AppError> {
        // グローバル限界器で 2.1s 間隔 + 30 req/min を強制する (全 AniList 要求で共有)。
        ANILIST_LIMITER.acquire().await?;

        let request_body = json!({
            "query": query,
            "variables": variables
        });

        let response = self
            .client
            .post(ANILIST_API_URL)
            .header("Content-Type", "application/json")
            .header("User-Agent", "OtakuPulse/1.0.0 (personal use)")
            .json(&request_body)
            .send()
            .await?;

        let status = response.status();
        if status.is_success() {
            let text = response.text().await?;
            Ok(text)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(AppError::Network(format!(
                "AniList API error: {} - {}",
                status, error_text
            )))
        }
    }

    /// Fetch seasonal anime
    pub async fn fetch_seasonal_anime(
        &self,
        season: &str,
        year: i32,
        page: Option<i32>,
    ) -> Result<Vec<crate::models::Article>, AppError> {
        let query = include_str!("../../graphql/seasonal_anime.graphql");

        let variables = json!({
            "season": season,
            "year": year,
            "page": page.unwrap_or(1)
        });

        let response = self.execute_query(query, variables).await?;

        let articles =
            graphql_parser::anilist_to_articles(&response, "anime").map_err(AppError::Parse)?;

        Ok(articles)
    }

    /// Fetch trending manga
    pub async fn fetch_trending_manga(
        &self,
        page: Option<i32>,
    ) -> Result<Vec<crate::models::Article>, AppError> {
        let query = include_str!("../../graphql/trending_manga.graphql");

        let variables = json!({
            "page": page.unwrap_or(1)
        });

        let response = self.execute_query(query, variables).await?;

        let articles =
            graphql_parser::anilist_to_articles(&response, "manga").map_err(AppError::Parse)?;

        Ok(articles)
    }
}

/// v1.1: ウォッチリストエントリ
#[derive(Debug, Clone)]
pub struct WatchlistEntry {
    pub media_id: i64,
    pub title_romaji: String,
    pub title_native: Option<String>,
    pub status: String,
    pub media_type: String,
    pub cover_image_url: Option<String>,
}

impl AniListClient {
    /// v1.1: ユーザーのウォッチリストを取得 (CURRENT + PLANNING)
    pub async fn fetch_user_watchlist(
        &self,
        username: &str,
    ) -> Result<Vec<WatchlistEntry>, AppError> {
        let query = r#"
            query ($username: String) {
                MediaListCollection(userName: $username, type: ANIME, status_in: [CURRENT, PLANNING]) {
                    lists {
                        entries {
                            status
                            media {
                                id
                                title { romaji native }
                                type
                                coverImage { medium }
                            }
                        }
                    }
                }
            }
        "#;

        let variables = json!({ "username": username });
        let response = self.execute_query(query, variables).await?;

        parse_watchlist_response(&response)
    }
}

fn parse_watchlist_response(json_str: &str) -> Result<Vec<WatchlistEntry>, AppError> {
    let v: Value = serde_json::from_str(json_str)
        .map_err(|e| AppError::Parse(format!("AniList watchlist JSON parse error: {e}")))?;

    let lists = v
        .pointer("/data/MediaListCollection/lists")
        .and_then(|l| l.as_array())
        .ok_or_else(|| AppError::Parse("AniList: missing MediaListCollection.lists".to_string()))?;

    let mut entries = Vec::new();

    for list in lists {
        let list_entries = list["entries"].as_array().unwrap_or(&vec![]).to_vec();
        for entry in list_entries {
            let status = entry["status"].as_str().unwrap_or("").to_string();
            let media = &entry["media"];
            let media_id = media["id"]
                .as_i64()
                .ok_or_else(|| AppError::Parse("AniList: missing media.id".to_string()))?;
            let title_romaji = media["title"]["romaji"].as_str().unwrap_or("").to_string();
            let title_native = media["title"]["native"].as_str().map(|s| s.to_string());
            let media_type = media["type"].as_str().unwrap_or("ANIME").to_string();
            let cover_image_url = media["coverImage"]["medium"]
                .as_str()
                .map(|s| s.to_string());

            entries.push(WatchlistEntry {
                media_id,
                title_romaji,
                title_native,
                status,
                media_type,
                cover_image_url,
            });
        }
    }

    Ok(entries)
}

/// Public function to execute AniList GraphQL queries
pub async fn query_anilist(query: &str, variables: &serde_json::Value) -> Result<String, AppError> {
    let client = crate::infra::http_client::build_http_client();
    let anilist_client = AniListClient::new(client);
    anilist_client.execute_query(query, variables.clone()).await
}

#[cfg(test)]
#[path = "anilist_client_tests.rs"]
mod tests;
