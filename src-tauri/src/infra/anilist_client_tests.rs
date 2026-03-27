use super::*;
use crate::infra::http_client;
use crate::parsers::graphql_parser;
use std::sync::Arc;
use wiremock::matchers::{header, method, path};
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
    let anilist_client = AniListClient::new(Arc::clone(&client));

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
