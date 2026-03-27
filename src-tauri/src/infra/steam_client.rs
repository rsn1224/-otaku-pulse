use crate::error::AppError;
use crate::models::Article;
use crate::parsers::bbcode_parser;
use chrono::Utc;
use reqwest::Client;
use serde_json::Value;
use std::sync::Arc;

pub struct SteamClient {
    client: Arc<Client>,
}

impl SteamClient {
    pub fn new(client: Arc<Client>) -> Self {
        Self { client }
    }

    /// Extract AppID from steam:// URL
    pub fn extract_appid(url: &str) -> Result<u32, AppError> {
        if !url.starts_with("steam://") {
            return Err(AppError::InvalidInput("Not a steam:// URL".to_string()));
        }

        // steam://appid/12345 or steam://run/12345
        let parts: Vec<&str> = url.split('/').collect();
        if parts.len() < 4 {
            return Err(AppError::InvalidInput(
                "Invalid steam:// URL format".to_string(),
            ));
        }

        let appid_str = parts[3];
        let appid = appid_str
            .parse::<u32>()
            .map_err(|_| AppError::InvalidInput("Invalid AppID".to_string()))?;

        Ok(appid)
    }

    /// Fetch news for a Steam app
    pub async fn fetch_app_news(&self, appid: u32) -> Result<Vec<Article>, AppError> {
        let url = format!(
            "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid={}&count=10&maxlength=0&format=json",
            appid
        );

        let response = self
            .client
            .get(&url)
            .header("User-Agent", "OtakuPulse/1.0.0 (personal use)")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Network(format!(
                "Steam API error: {}",
                response.status()
            )));
        }

        let json: Value = response
            .json()
            .await
            .map_err(|e| AppError::Parse(format!("Failed to parse Steam response: {}", e)))?;

        parse_steam_news_json(&json, appid)
    }
}

pub(crate) fn parse_steam_news_json(json: &Value, appid: u32) -> Result<Vec<Article>, AppError> {
    let news_items = json["appnews"]["newsitems"]
        .as_array()
        .ok_or_else(|| AppError::Parse("Invalid news items format".to_string()))?;

    let mut articles = Vec::new();

    for item in news_items.iter() {
        let title = item["title"]
            .as_str()
            .ok_or_else(|| AppError::Parse("Missing title".to_string()))?;

        let url = item["url"]
            .as_str()
            .ok_or_else(|| AppError::Parse("Missing URL".to_string()))?;

        let contents = item["contents"].as_str().unwrap_or("");

        // Convert BBCode to plain text
        let content = bbcode_parser::bbcode_to_plain(contents);

        // Extract feed information
        let feedid = item["feedid"].as_u64().unwrap_or(0) as i64;

        let date = item["date"].as_u64().unwrap_or(0);

        let author = item["author"].as_str().unwrap_or("Steam");

        // Build external ID
        let external_id = format!("steam:{}:{}", appid, feedid);

        // Build published date
        let published_at = if date > 0 {
            Some(
                chrono::DateTime::from_timestamp(date as i64, 0)
                    .unwrap_or_else(chrono::Utc::now)
                    .format("%Y-%m-%d")
                    .to_string(),
            )
        } else {
            None
        };

        // Build content hash
        let content_hash = Some(crate::parsers::rss_parser::generate_content_hash(&content));

        // Detect language (English content)
        let language = Some("en".to_string());

        // Build metadata JSON
        let metadata = serde_json::json!({
            "appid": appid,
            "feedid": feedid,
            "author": author,
            "date": date,
            "tags": item["tags"].as_array().unwrap_or(&vec![]),
        });

        let article = Article {
            id: 0,      // Will be set by database
            feed_id: 0, // Will be set by caller
            external_id: Some(external_id),
            title: title.to_string(),
            url: Some(url.to_string()),
            url_normalized: None, // Will be set by dedup service
            content: Some(content),
            summary: None, // Can be generated from content
            author: Some(author.to_string()),
            published_at,
            importance_score: calculate_importance_score(item),
            is_read: false,
            is_bookmarked: false,
            is_duplicate: false,
            duplicate_of: None,
            language,
            thumbnail_url: None, // Steam news doesn't have thumbnails
            content_hash,
            metadata: Some(metadata.to_string()),
            created_at: Utc::now().to_rfc3339(),
        };

        articles.push(article);
    }

    Ok(articles)
}

fn calculate_importance_score(item: &Value) -> f64 {
    let mut score = 0.5; // Base score

    // Add points for content length (longer news might be more important)
    if let Some(contents) = item["contents"].as_str() {
        let length_score = (contents.len() as f64 / 1000.0).min(0.2);
        score += length_score;
    }

    // Add points for having tags
    if let Some(tags) = item["tags"].as_array() {
        let tag_score = (tags.len() as f64 / 10.0).min(0.1);
        score += tag_score;
    }

    // Add points for recent news (within last 7 days)
    if let Some(date) = item["date"].as_u64() {
        let now = Utc::now().timestamp() as u64;
        let days_old = (now.saturating_sub(date)) / 86400; // seconds to days
        if days_old <= 7 {
            score += 0.2;
        }
    }

    score.min(1.0)
}

#[cfg(test)]
#[path = "steam_client_tests.rs"]
mod tests;
