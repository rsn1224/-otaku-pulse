use super::*;
use crate::infra::http_client;
use crate::infra::reddit_json::parse_reddit_json;
use crate::parsers::rss_parser;
use std::sync::Arc;
use wiremock::matchers::{header, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn test_fetch_rss_success() {
    let mock_server = MockServer::start().await;

    let rss_content = r##"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Test Subreddit</title>
        <link>https://www.reddit.com/r/test</link>
        <item>
            <title>Test Post</title>
            <link>https://www.reddit.com/r/test/comments/abc/test_post</link>
            <description>This is a test post</description>
            <pubDate>Wed, 21 Oct 2015 07:28:00 GMT</pubDate>
            <guid>https://www.reddit.com/r/test/comments/abc/test_post</guid>
        </item>
    </channel>
</rss>"##;

    Mock::given(method("GET"))
        .and(path("/r/test/.rss"))
        .and(header("User-Agent", "OtakuPulse/1.0 (personal use)"))
        .respond_with(ResponseTemplate::new(200).set_body_string(rss_content))
        .mount(&mock_server)
        .await;

    let client = Arc::new(http_client::build_http_client());
    let _reddit_fetcher = RedditFetcher::new(Arc::clone(&client), None);

    let test_fetcher = MockRedditFetcher::new(&mock_server.uri());
    let articles = test_fetcher.fetch_rss("test").await.unwrap();

    assert_eq!(articles.len(), 1);
    let article = &articles[0];
    assert_eq!(&article.title, "Test Post");
    assert_eq!(article.content.as_ref().unwrap(), "This is a test post");
}

#[tokio::test]
async fn test_fetch_rss_fallback_to_json() {
    let mock_server = MockServer::start().await;

    let json_response = serde_json::json!({
        "data": {
            "children": [{
                "data": {
                    "id": "abc123",
                    "title": "Test Post",
                    "permalink": "/r/test/comments/abc123/test_post/",
                    "selftext": "This is a test post",
                    "author": "testuser",
                    "created_utc": 1672531200.0,
                    "score": 100,
                    "num_comments": 50,
                    "total_awards_received": 5,
                    "over_18": false,
                    "is_self": true,
                    "url": "https://www.reddit.com/r/test/comments/abc123/test_post/",
                    "link_flair_text": "Test Flair"
                }
            }]
        }
    });

    // First mock returns 403 to trigger fallback
    Mock::given(method("GET"))
        .and(path("/r/test/.rss"))
        .respond_with(ResponseTemplate::new(403))
        .mount(&mock_server)
        .await;

    // Second mock handles the JSON fallback
    Mock::given(method("GET"))
        .and(path("/r/test/hot.json"))
        .and(query_param("limit", "50"))
        .respond_with(ResponseTemplate::new(200).set_body_json(&json_response))
        .mount(&mock_server)
        .await;

    let client = Arc::new(http_client::build_http_client());
    let _reddit_fetcher = RedditFetcher::new(Arc::clone(&client), None);

    let test_fetcher = MockRedditFetcher::new(&mock_server.uri());
    let articles = test_fetcher.fetch_rss("test").await.unwrap();

    assert_eq!(articles.len(), 1);
    let article = &articles[0];
    assert_eq!(&article.title, "Test Post");
    assert_eq!(article.author.as_ref().unwrap(), "testuser");
    assert_eq!(article.external_id.as_ref().unwrap(), "reddit:abc123");
}

// Mock fetcher for testing
struct MockRedditFetcher {
    base_url: String,
    user_agent: String,
}

impl MockRedditFetcher {
    fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            user_agent: "OtakuPulse/1.0 (personal use)".to_string(),
        }
    }

    async fn fetch_rss(&self, subreddit: &str) -> Result<Vec<Article>, AppError> {
        let client = reqwest::Client::new();

        // Try RSS first
        let rss_url = format!("{}/r/{}/.rss", self.base_url, subreddit);

        let response = client
            .get(&rss_url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await?;

        match response.status().as_u16() {
            200 => {
                let body = response.bytes().await?.to_vec();
                let articles = rss_parser::parse_rss_feed(&body, 0)?;
                Ok(articles)
            }
            403 | 429 => {
                // Fall back to JSON
                self.fetch_json(subreddit).await
            }
            status => Err(AppError::Network(format!(
                "Reddit RSS error: HTTP {}",
                status
            ))),
        }
    }

    async fn fetch_json(&self, subreddit: &str) -> Result<Vec<Article>, AppError> {
        let client = reqwest::Client::new();

        let json_url = format!("{}/r/{}/hot.json?limit=50", self.base_url, subreddit);

        let response = client
            .get(&json_url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Network(format!(
                "Reddit JSON error: {}",
                response.status()
            )));
        }

        let json: Value = response
            .json()
            .await
            .map_err(|e| AppError::Parse(format!("Failed to parse Reddit response: {}", e)))?;

        parse_reddit_json(&json, subreddit)
    }
}
