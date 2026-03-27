use sha2::{Digest, Sha256};

/// Generate SHA-256 hash of content
pub fn generate_content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Normalize URL for deduplication
pub fn normalize_url(url: &str) -> String {
    let mut normalized = url.trim().to_string();

    // Remove fragment
    if let Some(hash_pos) = normalized.rfind('#') {
        normalized.truncate(hash_pos);
    }

    // Remove trailing slash
    normalized = normalized.trim_end_matches('/').to_string();

    // Convert to lowercase
    normalized = normalized.to_lowercase();

    normalized
}

/// Simple language detection (very basic, could be improved)
pub fn detect_language(title: &str, content: Option<&str>) -> Option<String> {
    let text = format!("{} {}", title, content.unwrap_or(""));

    // Simple heuristic: if contains Japanese characters, assume Japanese
    if text.chars().any(|c| {
        (0x3040..=0x309F).contains(&(c as u32)) || // Hiragana
        (0x30A0..=0x30FF).contains(&(c as u32)) || // Katakana
        (0x4E00..=0x9FFF).contains(&(c as u32)) // Kanji
    }) {
        Some("ja".to_string())
    } else {
        Some("en".to_string()) // Default to English
    }
}

pub fn is_image_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.contains(".jpg")
        || lower.contains(".jpeg")
        || lower.contains(".png")
        || lower.contains(".webp")
        || lower.contains(".gif")
}

/// HTML から最初の <img> タグの src を抽出
pub fn extract_img_from_html(html: &str) -> Option<String> {
    // <img ... src="URL" ...> パターンを検索
    let img_start = html.find("<img ")?;
    let after_img = &html[img_start..];
    let src_start = after_img
        .find("src=\"")
        .or_else(|| after_img.find("src='"))?;
    let quote = after_img.as_bytes()[src_start + 4] as char;
    let url_start = src_start + 5;
    let url_end = after_img[url_start..].find(quote)?;
    let url = &after_img[url_start..url_start + url_end];

    // data: URL は除外
    if url.starts_with("data:") || url.len() < 10 {
        return None;
    }

    Some(url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_content_hash() {
        let hash1 = generate_content_hash("test content");
        let hash2 = generate_content_hash("test content");
        let hash3 = generate_content_hash("different content");

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);

        // Hash should be 64 characters (SHA-256 hex)
        assert_eq!(hash1.len(), 64);
    }

    #[test]
    fn test_normalize_url() {
        assert_eq!(
            normalize_url("https://example.com/path#fragment"),
            "https://example.com/path"
        );
        assert_eq!(
            normalize_url("https://example.com/path/"),
            "https://example.com/path"
        );
        assert_eq!(
            normalize_url("HTTPS://EXAMPLE.COM/PATH"),
            "https://example.com/path"
        );
        assert_eq!(
            normalize_url("https://example.com/path/?query=1#frag"),
            "https://example.com/path/?query=1"
        );
    }

    #[test]
    fn test_detect_language() {
        assert_eq!(detect_language("テスト", None), Some("ja".to_string()));
        assert_eq!(detect_language("test", None), Some("en".to_string()));
        assert_eq!(detect_language("テストtest", None), Some("ja".to_string()));
        assert_eq!(
            detect_language("テスト", Some("content")),
            Some("ja".to_string())
        );
    }
}
