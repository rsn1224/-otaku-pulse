use sha2::{Digest, Sha256};
use std::collections::HashSet;
use unicode_normalization::UnicodeNormalization;

/// URL 正規化: http→https, www除去, フラグメント除去, トラッキングパラメータ除去
pub fn normalize_url(url: &str) -> String {
    let mut normalized = url.to_string();

    if normalized.starts_with("http://") {
        normalized = normalized.replacen("http://", "https://", 1);
    }
    if normalized.starts_with("https://www.") {
        normalized = normalized.replacen("https://www.", "https://", 1);
    }
    if let Some(fragment_pos) = normalized.find('#') {
        normalized.truncate(fragment_pos);
    }
    if normalized.ends_with('/') && normalized.len() > 8 {
        normalized.pop();
    }

    if let Some(query_pos) = normalized.find('?') {
        let base_url = &normalized[..query_pos];
        let query = &normalized[query_pos + 1..];

        let tracking_params = [
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "ref",
            "source",
            "fbclid",
            "gclid",
            "msclkid",
            "mc_cid",
            "mc_eid",
        ];

        let mut filtered_params: Vec<&str> = query
            .split('&')
            .filter(|p| {
                p.split_once('=')
                    .map_or(true, |(k, _)| !tracking_params.contains(&k))
            })
            .collect();
        filtered_params.sort();

        if !filtered_params.is_empty() {
            normalized = format!("{}?{}", base_url, filtered_params.join("&"));
        } else {
            normalized = base_url.to_string();
        }
    }

    if let Some(scheme_end) = normalized.find("://") {
        let after_scheme = scheme_end + 3;
        if let Some(host_len) = normalized[after_scheme..].find('/') {
            let host = &normalized[after_scheme..after_scheme + host_len];
            let rest = &normalized[after_scheme + host_len..];
            normalized = format!(
                "{}{}{}",
                &normalized[..after_scheme],
                host.to_lowercase(),
                rest
            );
        } else {
            let host = &normalized[after_scheme..];
            normalized = format!("{}{}", &normalized[..after_scheme], host.to_lowercase());
        }
    }

    normalized
}

/// タイトル正規化: NFKC + 記号除去 + 小文字化
pub fn normalize_title(title: &str) -> String {
    let normalized = title.nfc().collect::<String>();
    let symbols = [
        '「', '」', '『', '』', '【', '】', '（', '）', '(', ')', '[', ']', '<', '>', '・', '、',
        '。', ',', '.', '!', '?', '！', '？', '　',
    ];
    let mut result: String = normalized.chars().filter(|c| !symbols.contains(c)).collect();
    result = result.to_lowercase();
    while result.contains("  ") {
        result = result.replace("  ", " ");
    }
    result.trim().to_string()
}

/// Layer 2: Jaccard bigram 類似度
pub fn jaccard_bigram_similarity(a: &str, b: &str) -> f64 {
    let a_norm = normalize_title(a);
    let b_norm = normalize_title(b);

    if a_norm.is_empty() && b_norm.is_empty() {
        return 1.0;
    }
    if a_norm.is_empty() || b_norm.is_empty() {
        return 0.0;
    }

    let bigrams_a: HashSet<(char, char)> = a_norm.chars().zip(a_norm.chars().skip(1)).collect();
    let bigrams_b: HashSet<(char, char)> = b_norm.chars().zip(b_norm.chars().skip(1)).collect();

    let intersection = bigrams_a.intersection(&bigrams_b).count();
    let union = bigrams_a.union(&bigrams_b).count();

    if union == 0 {
        return 0.0;
    }
    intersection as f64 / union as f64
}

/// Layer 3: コンテンツハッシュ生成
pub fn generate_content_hash(content: &str) -> String {
    let normalized: String = content.chars().take(200).collect();
    let normalized = normalized.trim();
    format!("{:x}", Sha256::digest(normalized.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_url_removes_tracking() {
        assert_eq!(
            normalize_url("https://example.com/article?utm_source=twitter&id=123"),
            "https://example.com/article?id=123"
        );
    }

    #[test]
    fn test_normalize_url_http_to_https() {
        assert_eq!(
            normalize_url("http://www.example.com/path/"),
            "https://example.com/path"
        );
    }

    #[test]
    fn test_normalize_url_removes_fragment() {
        assert_eq!(
            normalize_url("https://example.com/page#section"),
            "https://example.com/page"
        );
    }

    #[test]
    fn test_normalize_title() {
        assert_eq!(
            normalize_title("「進撃の巨人」最終回！"),
            "進撃の巨人最終回"
        );
    }

    #[test]
    fn test_jaccard_identical() {
        assert!((jaccard_bigram_similarity("進撃の巨人", "進撃の巨人") - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_jaccard_similar() {
        let score = jaccard_bigram_similarity("進撃の巨人 最終回", "「進撃の巨人」最終回放送決定");
        assert!(score >= 0.4, "score was {}", score);
    }

    #[test]
    fn test_jaccard_different() {
        let score = jaccard_bigram_similarity("天気予報", "株式市場");
        assert!(score < 0.2, "score was {}", score);
    }

    #[test]
    fn test_jaccard_empty() {
        assert!((jaccard_bigram_similarity("", "") - 1.0).abs() < 0.01);
        assert!((jaccard_bigram_similarity("abc", "")).abs() < 0.01);
    }

    #[test]
    fn test_content_hash() {
        let hash = generate_content_hash("Hello World");
        assert_eq!(hash.len(), 64); // SHA-256 hex
        // 同じ入力 → 同じ出力
        assert_eq!(hash, generate_content_hash("Hello World"));
    }
}
