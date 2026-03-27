use crate::error::AppError;
use crate::models::Article;
use crate::parsers::rss_parser;
use chrono::Utc;
use serde_json::Value;

pub(crate) fn parse_reddit_json(json: &Value, subreddit: &str) -> Result<Vec<Article>, AppError> {
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
