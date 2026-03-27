use crate::models::Article;
use chrono::Utc;

pub use super::graphql_types::*;

/// Convert AniList response to Vec<Article>
pub fn anilist_to_articles(response: &str, _category: &str) -> Result<Vec<Article>, String> {
    // Debug: log first 500 chars of response
    tracing::debug!(
        "AniList response preview: {}",
        &response[..response.len().min(500)]
    );

    let anilist_response: AniListResponse = serde_json::from_str(response)
        .map_err(|e| format!("Failed to parse AniList response: {}", e))?;

    let mut articles = Vec::new();

    for media in anilist_response.data.page.media {
        let title = get_preferred_title(&media.title);
        let description = media.description.as_deref().unwrap_or_default();

        // Convert HTML description to plain text
        let content = convert_html_to_text(description);

        // Build external ID
        let external_id = format!("anilist:{}", media.id);

        // Build URL
        let url = format!("https://anilist.co/anime/{}", media.id);

        // Build published date
        let published_at = media
            .start_date
            .as_ref()
            .and_then(|d| d.year)
            .map(|y| format!("{}-01-01", y));

        // Build thumbnail URL
        let thumbnail_url = media.cover_image.as_ref().and_then(|img| img.large.clone());

        // Build content hash
        let content_hash = Some(crate::parsers::rss_parser::generate_content_hash(&content));

        // Detect language (Japanese content)
        let language = Some("ja".to_string());

        // Build metadata JSON
        let metadata = serde_json::json!({
            "anilist_id": media.id,
            "type": media.media_type,
            "format": media.format,
            "status": media.status,
            "episodes": media.episodes,
            "chapters": media.chapters,
            "genres": media.genres,
            "average_score": media.average_score,
            "popularity": media.popularity,
            "trending": media.trending,
            "external_links": media.external_links,
        });

        let article = Article {
            id: 0,      // Will be set by database
            feed_id: 0, // Will be set by caller
            external_id: Some(external_id),
            title,
            url: Some(url),
            url_normalized: None, // Will be set by dedup service
            content: Some(content),
            summary: None, // Can be generated from content
            author: None,  // Not applicable for AniList
            published_at,
            importance_score: calculate_importance_score(&media),
            is_read: false,
            is_bookmarked: false,
            is_duplicate: false,
            duplicate_of: None,
            language,
            thumbnail_url,
            content_hash,
            metadata: Some(metadata.to_string()),
            created_at: Utc::now().to_rfc3339(),
        };

        articles.push(article);
    }

    Ok(articles)
}

pub(crate) fn get_preferred_title(title: &MediaTitle) -> String {
    title
        .user_preferred
        .clone()
        .or_else(|| title.english.clone())
        .or_else(|| title.romaji.clone())
        .or_else(|| title.native.clone())
        .unwrap_or_else(|| "Untitled".to_string())
}

pub(crate) fn convert_html_to_text(html: &str) -> String {
    use regex::Regex;
    use std::sync::LazyLock;

    static RE_HTML: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"<[^>]*>").expect("valid regex"));
    static RE_WS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s+").expect("valid regex"));

    // Remove HTML tags
    let text = RE_HTML.replace_all(html, "");

    // Decode common HTML entities
    let text = text
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#039;", "'")
        .replace("&nbsp;", " ");

    // Normalize whitespace
    RE_WS.replace_all(&text, " ").trim().to_string()
}

pub(crate) fn calculate_importance_score(media: &Media) -> f64 {
    let mut score = 0.5; // Base score

    // Add points for popularity
    if let Some(popularity) = media.popularity {
        score += (popularity as f64 / 10000.0).min(0.3);
    }

    // Add points for trending
    if let Some(trending) = media.trending {
        score += (trending as f64 / 1000.0).min(0.2);
    }

    // Add points for average score
    if let Some(avg_score) = media.average_score {
        score += (avg_score as f64 / 100.0) * 0.2;
    }

    // Add points for genre count (more genres = more comprehensive)
    score += (media.genres.len() as f64 / 20.0).min(0.1);

    score.min(1.0)
}

/// Parse anime schedule from AniList response
#[allow(dead_code)]
pub fn parse_anime_schedule(response: &str, _category: &str) -> Result<Vec<Media>, String> {
    let anilist_response: AniListResponse = serde_json::from_str(response)
        .map_err(|e| format!("Failed to parse AniList response: {}", e))?;

    Ok(anilist_response.data.page.media)
}

#[cfg(test)]
#[path = "graphql_parser_tests.rs"]
mod tests;
