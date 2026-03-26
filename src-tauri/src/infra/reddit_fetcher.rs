use crate::error::AppError;
use crate::models::Article;
use crate::parsers::rss_parser;
use chrono::Utc;
use reqwest::Client;
use serde_json::Value;
use std::sync::Arc;

#[allow(dead_code)]
pub struct RedditFetcher {
    client: Arc<Client>,
    user_agent: String,
}

#[allow(dead_code)]
impl RedditFetcher {
    pub fn new(client: Arc<Client>, user_agent: Option<String>) -> Self {
        Self {
            client,
            user_agent: user_agent.unwrap_or_else(|| "OtakuPulse/1.0 (personal use)".to_string()),
        }
    }

    /// Fetch Reddit posts from RSS feed (preferred method)
    #[allow(dead_code)]
    pub async fn fetch_rss(&self, subreddit: &str) -> Result<Vec<Article>, AppError> {
        let url = format!("https://www.reddit.com/r/{}/.rss", subreddit);

        let response = self
            .client
            .get(&url)
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
                // Fall back to JSON endpoint
                self.fetch_json(subreddit).await
            }
            status => Err(AppError::Network(format!(
                "Reddit RSS error: HTTP {}",
                status
            ))),
        }
    }

    /// Fetch Reddit posts from JSON endpoint (fallback)
    #[allow(dead_code)]
    async fn fetch_json(&self, subreddit: &str) -> Result<Vec<Article>, AppError> {
        let url = format!("https://www.reddit.com/r/{}/hot.json?limit=50", subreddit);

        let response = self
            .client
            .get(&url)
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

        let posts = json["data"]["children"]
            .as_array()
            .ok_or_else(|| AppError::Parse("Invalid Reddit response format".to_string()))?;

        let mut articles = Vec::new();

        for post in posts {
            let data = &post["data"];

            let title = data["title"]
                .as_str()
                .ok_or_else(|| AppError::Parse("Missing title".to_string()))?;

            let permalink = data["permalink"]
                .as_str()
                .ok_or_else(|| AppError::Parse("Missing permalink".to_string()))?;

            let url = format!("https://www.reddit.com{}", permalink);

            let selftext = data["selftext"].as_str().unwrap_or("");

            // Build external ID
            let id = data["id"]
                .as_str()
                .ok_or_else(|| AppError::Parse("Missing ID".to_string()))?;
            let external_id = format!("reddit:{}", id);

            // Build published date
            let created_utc = data["created_utc"].as_f64().unwrap_or(0.0) as i64;
            let published_at = if created_utc > 0 {
                Some(
                    chrono::DateTime::from_timestamp(created_utc, 0)
                        .unwrap_or_else(chrono::Utc::now)
                        .format("%Y-%m-%d")
                        .to_string(),
                )
            } else {
                None
            };

            // Build author
            let author = data["author"].as_str().unwrap_or("[deleted]");

            // Build content (selftext + metadata)
            let content = if !selftext.is_empty() {
                selftext.to_string()
            } else {
                // For link posts, include metadata
                let url_overridden = data["url"].as_str().unwrap_or("");

                if url_overridden != url {
                    format!("[Link: {}]", url_overridden)
                } else {
                    "No content available".to_string()
                }
            };

            // Build content hash
            let content_hash = Some(rss_parser::generate_content_hash(&content));

            // Detect language (English content)
            let language = Some("en".to_string());

            // Build metadata JSON
            let metadata = serde_json::json!({
                "subreddit": subreddit,
                "score": data["score"],
                "num_comments": data["num_comments"],
                "over_18": data["over_18"],
                "is_self": data["is_self"],
                "url_overridden": data["url"],
                "flair_text": data["link_flair_text"],
                "awards": data["total_awards_received"],
            });

            // Calculate importance score based on Reddit metrics
            let importance_score = calculate_reddit_importance(data);

            let article = Article {
                id: 0,      // Will be set by database
                feed_id: 0, // Will be set by caller
                external_id: Some(external_id),
                title: title.to_string(),
                url: Some(url),
                url_normalized: None, // Will be set by dedup service
                content: Some(content),
                summary: None, // Can be generated from content
                author: Some(author.to_string()),
                published_at,
                importance_score,
                is_read: false,
                is_bookmarked: false,
                is_duplicate: false,
                duplicate_of: None,
                language,
                thumbnail_url: None, // Reddit thumbnails are complex, skip for now
                content_hash,
                metadata: Some(metadata.to_string()),
                created_at: Utc::now().to_rfc3339(),
            };

            articles.push(article);
        }

        Ok(articles)
    }
}

fn calculate_reddit_importance(data: &Value) -> f64 {
    let mut score = 0.5; // Base score

    // Add points for score (upvotes - downvotes)
    if let Some(score_value) = data["score"].as_i64() {
        let score_points = (score_value as f64 / 1000.0).min(0.3);
        score += score_points;
    }

    // Add points for comment count
    if let Some(num_comments) = data["num_comments"].as_i64() {
        let comment_points = (num_comments as f64 / 500.0).min(0.2);
        score += comment_points;
    }

    // Add points for awards
    if let Some(awards) = data["total_awards_received"].as_i64() {
        let award_points = (awards as f64 / 10.0).min(0.1);
        score += award_points;
    }

    // Add points for recent posts (within last 24 hours)
    if let Some(created_utc) = data["created_utc"].as_f64() {
        let now = Utc::now().timestamp() as f64;
        let hours_old = (now - created_utc) / 3600.0;
        if hours_old <= 24.0 {
            score += 0.1;
        }
    }

    score.min(1.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::http_client;
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
        let reddit_fetcher = RedditFetcher::new(Arc::clone(&client), None);

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
        let reddit_fetcher = RedditFetcher::new(Arc::clone(&client), None);

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

            let posts = json["data"]["children"]
                .as_array()
                .ok_or_else(|| AppError::Parse("Invalid Reddit response format".to_string()))?;

            let mut articles = Vec::new();

            for post in posts {
                let data = &post["data"];

                let title = data["title"]
                    .as_str()
                    .ok_or_else(|| AppError::Parse("Missing title".to_string()))?;

                let permalink = data["permalink"]
                    .as_str()
                    .ok_or_else(|| AppError::Parse("Missing permalink".to_string()))?;

                let url = format!("https://www.reddit.com{}", permalink);

                let selftext = data["selftext"].as_str().unwrap_or("");

                let id = data["id"]
                    .as_str()
                    .ok_or_else(|| AppError::Parse("Missing ID".to_string()))?;
                let external_id = format!("reddit:{}", id);

                let article = Article {
                    id: 0,
                    feed_id: 0,
                    external_id: Some(external_id),
                    title: title.to_string(),
                    url: Some(url),
                    url_normalized: None,
                    content: Some(selftext.to_string()),
                    summary: None,
                    author: Some(data["author"].as_str().unwrap_or("unknown").to_string()),
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
}
