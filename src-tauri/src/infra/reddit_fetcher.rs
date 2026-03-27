use crate::error::AppError;
use crate::models::Article;
use crate::parsers::rss_parser;
use reqwest::Client;
use serde_json::Value;
use std::sync::Arc;

use super::reddit_json::parse_reddit_json;

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

        parse_reddit_json(&json, subreddit)
    }
}

#[cfg(test)]
#[path = "reddit_fetcher_tests.rs"]
mod tests;
