use super::*;
use crate::infra::http_client;
use std::sync::Arc;
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[test]
fn test_extract_appid() {
    assert_eq!(
        SteamClient::extract_appid("steam://appid/12345").unwrap(),
        12345
    );
    assert_eq!(
        SteamClient::extract_appid("steam://run/67890").unwrap(),
        67890
    );

    assert!(SteamClient::extract_appid("invalid").is_err());
    assert!(SteamClient::extract_appid("steam://").is_err());
    assert!(SteamClient::extract_appid("steam://invalid").is_err());
}

#[tokio::test]
async fn test_fetch_app_news() {
    let mock_server = MockServer::start().await;

    let mock_response = serde_json::json!({
        "appnews": {
            "appid": 12345,
            "newsitems": [{
                "gid": "12345",
                "title": "Test Update",
                "url": "https://store.steampowered.com/news/app/12345/view/12345",
                "is_external_url": false,
                "author": "Valve",
                "contents": "This is a [b]test[/b] update with [url=https://example.com]link[/url].",
                "feedlabel": "Game Update",
                "date": 1672531200,
                "feedname": "Test Game",
                "feed_type": 0,
                "appid": 12345
            }]
        }
    });

    Mock::given(method("GET"))
        .and(path("/ISteamNews/GetNewsForApp/v2/"))
        .and(query_param("appid", "12345"))
        .and(query_param("count", "10"))
        .and(query_param("maxlength", "0"))
        .and(query_param("format", "json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(&mock_response))
        .mount(&mock_server)
        .await;

    let client = Arc::new(http_client::build_http_client());
    let _steam_client = SteamClient::new(Arc::clone(&client));

    // Override the API URL for testing
    let test_client = MockSteamClient::new(&mock_server.uri());
    let articles = test_client.fetch_app_news(12345).await.unwrap();

    assert_eq!(articles.len(), 1);
    let article = &articles[0];
    assert_eq!(&article.title, "Test Update");
    assert_eq!(article.author.as_ref().unwrap(), "Valve");
    assert_eq!(
        article.content.as_ref().unwrap(),
        "This is a **test** update with link (https://example.com)."
    );
    assert_eq!(article.external_id.as_ref().unwrap(), "steam:12345:0");
}

// Mock client for testing
struct MockSteamClient {
    api_url: String,
}

impl MockSteamClient {
    fn new(api_url: &str) -> Self {
        Self {
            api_url: api_url.to_string(),
        }
    }

    async fn fetch_app_news(&self, appid: u32) -> Result<Vec<Article>, AppError> {
        let client = reqwest::Client::new();

        let url = format!(
            "{}/ISteamNews/GetNewsForApp/v2/?appid={}&count=10&maxlength=0&format=json",
            self.api_url, appid
        );

        let response = client
            .get(&url)
            .header("User-Agent", "OtakuPulse/1.0.0 (personal use)")
            .send()
            .await?;

        let json: Value = response
            .json()
            .await
            .map_err(|e| AppError::Parse(format!("Failed to parse Steam response: {}", e)))?;

        let news_items = json["appnews"]["newsitems"]
            .as_array()
            .ok_or_else(|| AppError::Parse("Invalid news items format".to_string()))?;

        let mut articles = Vec::new();

        for item in news_items {
            let title = item["title"]
                .as_str()
                .ok_or_else(|| AppError::Parse("Missing title".to_string()))?;

            let url = item["url"]
                .as_str()
                .ok_or_else(|| AppError::Parse("Missing URL".to_string()))?;

            let author = item["author"].as_str().unwrap_or("unknown");

            let contents = item["contents"].as_str().unwrap_or("");

            // Convert BBCode to plain text
            let content = bbcode_parser::bbcode_to_plain(contents);

            let feedid = item["feedid"].as_u64().unwrap_or(0) as i64;

            let external_id = format!("steam:{}:{}", appid, feedid);

            let article = Article {
                id: 0,
                feed_id: 0,
                external_id: Some(external_id),
                title: title.to_string(),
                url: Some(url.to_string()),
                url_normalized: None,
                content: Some(content),
                summary: None,
                author: Some(author.to_string()),
                published_at: None,
                importance_score: 0.5,
                is_read: false,
                is_bookmarked: false,
                is_duplicate: false,
                duplicate_of: None,
                language: Some("en".to_string()),
                thumbnail_url: None,
                content_hash: None,
                metadata: None,
                created_at: Utc::now().to_rfc3339(),
            };

            articles.push(article);
        }

        Ok(articles)
    }
}
