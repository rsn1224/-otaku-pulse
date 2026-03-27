use crate::error::AppError;
use crate::models::Article;
use chrono::{DateTime, Utc};
use feed_rs::parser;
use tracing::{info, warn};

// Re-export for external callers
pub use super::rss_helpers::{detect_language, generate_content_hash, normalize_url};
use super::rss_helpers::{extract_img_from_html, is_image_url};

/// Parse RSS/Atom feed from raw bytes and convert to Articles
pub fn parse_rss_feed(raw: &[u8], feed_id: i64) -> Result<Vec<Article>, AppError> {
    // Parse the feed using feed-rs
    let feed = parser::parse(raw)
        .map_err(|e| AppError::FeedParse(format!("Failed to parse RSS feed: {}", e)))?;

    info!(
        "Parsed feed '{}' with {} entries",
        feed.title
            .map(|t| t.content)
            .unwrap_or("Unknown".to_string()),
        feed.entries.len()
    );

    let mut articles = Vec::new();

    for entry in feed.entries {
        // Convert feed entry to Article
        if let Some(article) = convert_entry_to_article(entry, feed_id) {
            articles.push(article);
        }
    }

    Ok(articles)
}

/// Convert a feed_rs Entry to an Article
fn convert_entry_to_article(entry: feed_rs::model::Entry, feed_id: i64) -> Option<Article> {
    // Title is required
    let title_obj = entry.title?;
    let title_text = title_obj.content.trim();
    let title = title_text.to_string();
    if title.is_empty() {
        warn!("Skipping entry with empty title");
        return None;
    }

    // Extract URL (prefer alternate links)
    let url = entry
        .links
        .iter()
        .find(|link| {
            link.rel.as_ref().map(|r| r == "alternate").unwrap_or(false) || link.rel.is_none()
        })
        .or_else(|| entry.links.first())
        .map(|link| link.href.clone());

    // Extract content (prefer summary, then content.body)
    let content = entry
        .summary
        .map(|t| t.content)
        .or_else(|| entry.content.and_then(|c| c.body))
        .filter(|s| !s.trim().is_empty());

    // Extract author
    let author = entry
        .authors
        .first()
        .map(|a| a.name.trim().to_string())
        .filter(|n| !n.is_empty());

    // Parse published date
    let published_at = entry.published.or(entry.updated).and_then(|dt| {
        // Convert chrono::DateTime<FixedOffset> to UTC string
        DateTime::from_timestamp(dt.timestamp(), dt.timestamp_subsec_nanos())
            .map(|dt| dt.with_timezone(&Utc))
            .map(|dt| dt.to_rfc3339())
    });

    // Extract external ID
    let external_id = if !entry.id.is_empty() {
        Some(entry.id.trim().to_string())
    } else {
        url.clone()
    }
    .filter(|id| !id.is_empty());

    // Generate content hash from first 200 characters of content
    let content_hash = content.as_ref().map(|c| {
        // Safe character boundary handling
        let chars: Vec<char> = c.chars().take(200).collect();
        let safe_str: String = chars.into_iter().collect();
        generate_content_hash(&safe_str)
    });

    // Normalize URL
    let url_normalized = url.as_ref().map(|u| normalize_url(u));

    // Extract thumbnail from media objects, enclosures, or content HTML
    let thumbnail_url = extract_thumbnail(&entry.media, &entry.links, content.as_deref());

    // Create article
    Some(Article {
        id: 0,
        feed_id,
        external_id,
        title: title.clone(),
        url,
        url_normalized,
        content: content.clone(),
        summary: None,
        author,
        published_at,
        importance_score: 0.0,
        is_read: false,
        is_bookmarked: false,
        is_duplicate: false,
        duplicate_of: None,
        language: detect_language(&title, content.as_deref()),
        thumbnail_url,
        content_hash,
        metadata: None,
        created_at: Utc::now().to_rfc3339(),
    })
}

/// RSS/Atom エントリからサムネイル画像 URL を抽出
/// 優先順: media:content → media:thumbnail → enclosure → HTML <img>
fn extract_thumbnail(
    media: &[feed_rs::model::MediaObject],
    links: &[feed_rs::model::Link],
    content: Option<&str>,
) -> Option<String> {
    // 1. media:content / media:thumbnail から画像を探す
    for media_obj in media {
        for media_content in &media_obj.content {
            if let Some(ref ct) = media_content.content_type
                && ct.to_string().starts_with("image/")
                && let Some(ref url) = media_content.url
            {
                return Some(url.to_string());
            }
            if let Some(ref url) = media_content.url {
                let s = url.to_string();
                if is_image_url(&s) {
                    return Some(s);
                }
            }
        }
        for thumb in &media_obj.thumbnails {
            let url_str = thumb.image.uri.clone();
            if !url_str.is_empty() {
                return Some(url_str);
            }
        }
    }

    // 2. enclosure リンク（type=image/*）
    for link in links {
        if let Some(ref media_type) = link.media_type
            && media_type.starts_with("image/")
        {
            return Some(link.href.clone());
        }
        if is_image_url(&link.href) && link.rel.as_deref() == Some("enclosure") {
            return Some(link.href.clone());
        }
    }

    // 3. HTML コンテンツから最初の <img src="..."> を抽出
    if let Some(html) = content
        && let Some(url) = extract_img_from_html(html)
    {
        return Some(url);
    }

    None
}

#[cfg(test)]
#[path = "rss_parser_tests.rs"]
mod tests;
