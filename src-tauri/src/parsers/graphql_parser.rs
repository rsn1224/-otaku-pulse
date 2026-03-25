use crate::models::Article;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;

#[derive(Deserialize, Debug)]
pub struct AniListResponse {
    pub data: AniListData,
}

#[derive(Deserialize, Debug)]
pub struct AniListData {
    pub page: AniListPage,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct AniListPage {
    #[serde(rename = "pageInfo")]
    pub page_info: PageInfo,
    pub media: Vec<Media>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct PageInfo {
    #[serde(rename = "total")]
    pub total: i32,
    #[serde(rename = "perPage")]
    pub per_page: i32,
    #[serde(rename = "currentPage")]
    pub current_page: i32,
    #[serde(rename = "lastPage")]
    pub last_page: i32,
    #[serde(rename = "hasNextPage")]
    pub has_next_page: bool,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct Media {
    pub id: i32,
    pub title: MediaTitle,
    #[serde(rename = "type")]
    pub media_type: String,
    pub format: Option<String>,
    pub status: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "startDate")]
    pub start_date: Option<FuzzyDate>,
    #[serde(rename = "endDate")]
    pub end_date: Option<FuzzyDate>,
    pub episodes: Option<i32>,
    pub chapters: Option<i32>,
    #[serde(rename = "coverImage")]
    pub cover_image: Option<MediaCoverImage>,
    #[serde(rename = "bannerImage")]
    pub banner_image: Option<String>,
    pub genres: Vec<String>,
    pub synonyms: Vec<String>,
    pub average_score: Option<i32>,
    pub popularity: Option<i32>,
    pub trending: Option<i32>,
    #[serde(rename = "externalLinks")]
    pub external_links: Vec<ExternalLink>,
}

#[derive(Deserialize, Debug)]
pub struct MediaTitle {
    pub romaji: Option<String>,
    pub english: Option<String>,
    pub native: Option<String>,
    pub user_preferred: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct MediaCoverImage {
    #[serde(rename = "large")]
    pub large: Option<String>,
    #[serde(rename = "medium")]
    pub medium: Option<String>,
    #[serde(rename = "color")]
    pub color: Option<String>,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct ExternalLink {
    pub site: String,
    pub url: String,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct FuzzyDate {
    pub year: Option<i32>,
    pub month: Option<i32>,
    pub day: Option<i32>,
}

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

fn get_preferred_title(title: &MediaTitle) -> String {
    title
        .user_preferred
        .clone()
        .or_else(|| title.english.clone())
        .or_else(|| title.romaji.clone())
        .or_else(|| title.native.clone())
        .unwrap_or_else(|| "Untitled".to_string())
}

fn convert_html_to_text(html: &str) -> String {
    use regex::Regex;

    // Remove HTML tags
    let re = Regex::new(r"<[^>]*>").unwrap();
    let text = re.replace_all(html, "");

    // Decode common HTML entities
    let text = text
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#039;", "'")
        .replace("&nbsp;", " ");

    // Normalize whitespace
    let re_ws = Regex::new(r"\s+").unwrap();
    re_ws.replace_all(&text, " ").trim().to_string()
}

fn calculate_importance_score(media: &Media) -> f64 {
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_anilist_to_articles() {
        let response = json!({
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
                        "description": "This is a <b>test</b> anime.",
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

        let articles = anilist_to_articles(&response.to_string(), "anime").unwrap();

        assert_eq!(articles.len(), 1);
        let article = &articles[0];
        assert_eq!(&article.title, "Test Anime");
        assert_eq!(article.content.as_ref().unwrap(), "This is a test anime.");
        assert_eq!(article.external_id.as_ref().unwrap(), "anilist:1");
        assert_eq!(article.url.as_ref().unwrap(), "https://anilist.co/anime/1");
        assert_eq!(article.published_at.as_ref().unwrap(), "2023-01-01");
        assert_eq!(
            article.thumbnail_url.as_ref().unwrap(),
            "https://example.com/image.jpg"
        );
        assert_eq!(article.language.as_ref().unwrap(), "ja");
    }

    #[test]
    fn test_convert_html_to_text() {
        assert_eq!(
            convert_html_to_text("<p>Hello <b>World</b></p>"),
            "Hello World"
        );
        assert_eq!(convert_html_to_text("A &amp; B"), "A & B");
        assert_eq!(
            convert_html_to_text("  Multiple   spaces  "),
            "Multiple spaces"
        );
    }

    #[test]
    fn test_calculate_importance_score() {
        let media = Media {
            id: 1,
            title: MediaTitle {
                romaji: Some("Test".to_string()),
                english: None,
                native: None,
                user_preferred: None,
            },
            media_type: "ANIME".to_string(),
            format: Some("TV".to_string()),
            status: Some("FINISHED".to_string()),
            description: None,
            start_date: None,
            end_date: None,
            episodes: Some(12),
            chapters: None,
            cover_image: None,
            banner_image: None,
            genres: vec!["Action".to_string(), "Adventure".to_string()],
            synonyms: vec![],
            average_score: Some(80),
            popularity: Some(1000),
            trending: Some(100),
            external_links: vec![],
        };

        let score = calculate_importance_score(&media);
        assert!(score > 0.5);
        assert!(score <= 1.0);
    }
}

/// Parse anime schedule from AniList response
#[allow(dead_code)]
pub fn parse_anime_schedule(response: &str, _category: &str) -> Result<Vec<Media>, String> {
    let anilist_response: AniListResponse = serde_json::from_str(response)
        .map_err(|e| format!("Failed to parse AniList response: {}", e))?;

    Ok(anilist_response.data.page.media)
}
