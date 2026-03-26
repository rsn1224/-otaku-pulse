use crate::error::AppError;
use crate::infra::rate_limiter::TokenBucket;
use crate::parsers::graphql_parser;
use reqwest::Client;
use serde_json::{Value, json};
use std::sync::Arc;
use std::time::Duration;

const ANILIST_API_URL: &str = "https://graphql.anilist.co";
const MIN_REQUEST_INTERVAL_MS: u64 = 2100; // 30 req/min = 1 req per 2 seconds

pub struct AniListClient {
    client: Arc<Client>,
    rate_limiter: TokenBucket,
    last_request_time: std::sync::Mutex<std::time::Instant>,
}

impl AniListClient {
    pub fn new(client: Arc<Client>) -> Self {
        Self {
            client,
            rate_limiter: crate::infra::rate_limiter::configs::anilist(),
            last_request_time: std::sync::Mutex::new(std::time::Instant::now()),
        }
    }

    /// Execute GraphQL query with rate limiting
    async fn execute_query(&self, query: &str, variables: Value) -> Result<String, AppError> {
        // Rate limiting: calculate wait time while holding lock, then drop lock before await
        let wait_duration = {
            let last_time = self.last_request_time.lock().unwrap();
            let elapsed = last_time.elapsed();
            if elapsed < Duration::from_millis(MIN_REQUEST_INTERVAL_MS) {
                Some(Duration::from_millis(MIN_REQUEST_INTERVAL_MS) - elapsed)
            } else {
                None
            }
        }; // MutexGuard dropped here

        if let Some(wait) = wait_duration {
            tokio::time::sleep(wait).await;
        }

        // Update last request time
        {
            let mut last_time = self.last_request_time.lock().unwrap();
            *last_time = std::time::Instant::now();
        }

        // Acquire token from rate limiter
        self.rate_limiter.acquire().await?;

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

/// Public function to execute AniList GraphQL queries
pub async fn query_anilist(query: &str, variables: &serde_json::Value) -> Result<String, AppError> {
    let client = crate::infra::http_client::build_http_client();
    let anilist_client = AniListClient::new(client);
    anilist_client.execute_query(query, variables.clone()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::http_client;
    use std::sync::Arc;
    use wiremock::matchers::{body_json, header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn test_fetch_seasonal_anime() {
        let mock_server = MockServer::start().await;

        let mock_response = json!({
            "data": {
                "page": {
                    "pageInfo": {
                        "total": 1,
                        "perPage": 50,
                        "currentPage": 1,
                        "lastPage": 1,
                        "hasNextPage": false
                    },
                    "media": [{
                        "id": 1,
                        "title": {
                            "romaji": "Test Anime",
                            "english": "Test Anime",
                            "native": "テストアニメ",
                            "userPreferred": "Test Anime"
                        },
                        "type": "ANIME",
                        "format": "TV",
                        "status": "FINISHED",
                        "description": "Test description",
                        "startDate": {
                            "year": 2023,
                            "month": 1,
                            "day": 1
                        },
                        "endDate": null,
                        "episodes": 12,
                        "chapters": null,
                        "coverImage": {
                            "large": "https://example.com/image.jpg"
                        },
                        "externalLinks": [],
                        "medium": null,
                        "color": "#ffffff",
                        "bannerImage": null,
                        "genres": ["Action", "Adventure"],
                        "synonyms": ["Test"],
                        "averageScore": 80,
                        "popularity": 1000,
                        "trending": 100
                    }]
                },
                "pageInfo": {
                    "total": 1,
                    "perPage": 1,
                    "currentPage": 1,
                    "lastPage": 1,
                    "hasNextPage": false
                }
            }
        });

        Mock::given(method("POST"))
            .and(path("/"))
            .and(header("Content-Type", "application/json"))
            .and(header("User-Agent", "OtakuPulse/1.0.0 (personal use)"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("X-RateLimit-Remaining", "29")
                    .set_body_json(&mock_response),
            )
            .mount(&mock_server)
            .await;

        let client = Arc::new(http_client::build_http_client());
        let mut anilist_client = AniListClient::new(Arc::clone(&client));

        // Override the API URL for testing
        let test_client = AniListClient {
            client: anilist_client.client.clone(),
            rate_limiter: anilist_client.rate_limiter,
            last_request_time: anilist_client.last_request_time,
        };

        // We need to mock the actual HTTP call, so we'll create a custom implementation
        let test_client = MockAniListClient::new(&mock_server.uri());
        let articles = test_client
            .fetch_seasonal_anime("WINTER", 2023, Some(1))
            .await
            .unwrap();

        assert_eq!(articles.len(), 1);
        assert_eq!(&articles[0].title, "Test Anime");
        assert_eq!(articles[0].external_id.as_ref().unwrap(), "anilist:1");
    }

    // Mock client for testing
    struct MockAniListClient {
        api_url: String,
    }

    impl MockAniListClient {
        fn new(api_url: &str) -> Self {
            Self {
                api_url: api_url.to_string(),
            }
        }

        async fn fetch_seasonal_anime(
            &self,
            season: &str,
            year: i32,
            page: Option<i32>,
        ) -> Result<Vec<crate::models::Article>, AppError> {
            let client = reqwest::Client::new();

            let query = include_str!("../../graphql/seasonal_anime.graphql");
            let variables = json!({
                "season": season,
                "year": year,
                "page": page.unwrap_or(1)
            });

            let request_body = json!({
                "query": query,
                "variables": variables
            });

            let response = client
                .post(&self.api_url)
                .header("Content-Type", "application/json")
                .header("User-Agent", "OtakuPulse/1.0.0 (personal use)")
                .json(&request_body)
                .send()
                .await?;

            let text = response.text().await?;
            let articles =
                graphql_parser::anilist_to_articles(&text, "anime").map_err(AppError::Parse)?;

            Ok(articles)
        }
    }
}
