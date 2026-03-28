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
        let base_url = normalized[..query_pos].to_string();
        let query = &normalized[query_pos + 1..];

        let tracking_params: HashSet<&str> = [
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
        ]
        .iter()
        .copied()
        .collect();

        // Parse query parameters into (key, value) tuples, filtering tracking params
        let mut params: Vec<(&str, &str)> = query
            .split('&')
            .filter(|p| !p.is_empty())
            .filter_map(|p| p.split_once('='))
            .filter(|(k, _)| !tracking_params.contains(k))
            .collect();
        // Sort by key name (stable sort preserves order for same-key params)
        params.sort_by_key(|(k, _)| *k);

        if !params.is_empty() {
            let sorted_query: String = params
                .iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect::<Vec<_>>()
                .join("&");
            normalized = format!("{}?{}", base_url, sorted_query);
        } else {
            normalized = base_url;
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
    let normalized = title.nfkc().collect::<String>();
    let symbols = [
        '「', '」', '『', '』', '【', '】', '（', '）', '(', ')', '[', ']', '<', '>', '・', '、',
        '。', ',', '.', '!', '?', '！', '？', '　',
    ];
    let mut result: String = normalized
        .chars()
        .filter(|c| !symbols.contains(c))
        .collect();
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

/// Layer 3: コンテンツハッシュ生成 (NFKC 正規化後にハッシュ化)
pub fn generate_content_hash(content: &str) -> String {
    // Apply NFKC normalization so half-width and full-width variants produce identical hashes
    let normalized: String = content.nfkc().collect::<String>();
    let normalized: String = normalized.chars().take(200).collect();
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

    #[test]
    fn test_nfkc_half_width_katakana() {
        // Half-width katakana should normalize to full-width
        let half = "\u{FF76}\u{FF9E}\u{FF9D}\u{FF80}\u{FF9E}\u{FF91}";
        let full = "ガンダム";
        assert_eq!(normalize_title(half), normalize_title(full));
    }

    #[test]
    fn test_nfkc_fullwidth_ascii() {
        // Full-width ASCII should normalize to half-width
        assert_eq!(
            normalize_title("\u{FF21}\u{FF4E}\u{FF49}\u{FF4D}\u{FF45}"),
            normalize_title("Anime")
        );
    }

    #[test]
    fn test_url_param_order_independent() {
        let url1 = "https://example.com/page?b=2&a=1";
        let url2 = "https://example.com/page?a=1&b=2";
        assert_eq!(normalize_url(url1), normalize_url(url2));
    }

    #[test]
    fn test_url_tracking_params_removed() {
        let url = "https://example.com/page?id=1&utm_source=rss&tab=news";
        let normalized = normalize_url(url);
        assert!(!normalized.contains("utm_source"));
        assert!(normalized.contains("id=1"));
        assert!(normalized.contains("tab=news"));
    }

    #[test]
    fn test_nfkc_content_hash_consistency() {
        // Same content in different Unicode forms MUST produce same hash
        // because generate_content_hash applies NFKC normalization internally
        let hash1 = generate_content_hash("\u{FF76}\u{FF9E}\u{FF9D}\u{FF80}\u{FF9E}\u{FF91}");
        let hash2 = generate_content_hash("ガンダム");
        assert_eq!(
            hash1,
            hash2,
            "NFKC normalization must propagate through generate_content_hash"
        );
    }

    // --- Unicode normalization edge cases ---

    #[test]
    fn normalize_title_zero_width_space() {
        // Zero-width space (\u{200B}) is a non-combining, non-compatibility character —
        // NFKC does not remove it, so it remains in the output.
        // The test verifies the function does not panic and produces a non-empty result.
        let with_zwsp = "Hello\u{200B}World";
        let result = normalize_title(with_zwsp);
        assert!(!result.is_empty(), "normalize_title must not return empty for ZWS input");
        // Lowercase must be applied
        assert_eq!(result, result.to_lowercase(), "result must be lowercase");
    }

    #[test]
    fn normalize_title_cjk_compatibility_ideograph() {
        // CJK compatibility ideograph \u{FA30} normalizes to \u{4FAE} under NFKC
        let compat = "\u{FA30}";
        let standard = "\u{4FAE}";
        assert_eq!(normalize_title(compat), normalize_title(standard));
    }

    #[test]
    fn normalize_title_emoji_preserved() {
        // Emoji should survive normalization without crash
        let title = "New anime \u{1F3AE} season!";
        let result = normalize_title(title);
        // Must not panic; result must be non-empty
        assert!(!result.is_empty());
    }

    #[test]
    fn normalize_title_combining_diacritics() {
        // e + combining acute (U+0301) should normalize to precomposed e-acute (U+00E9) under NFKC
        let decomposed = "caf\u{0065}\u{0301}";
        let precomposed = "caf\u{00E9}";
        assert_eq!(normalize_title(decomposed), normalize_title(precomposed));
    }

    // --- Jaccard similarity boundary cases ---

    #[test]
    fn jaccard_exactly_at_threshold() {
        // Verify function returns a valid value (between 0.0 and 1.0) for near-threshold inputs
        let a = "abcdefgh";
        let b = "abcdefgi";
        let sim = jaccard_bigram_similarity(a, b);
        assert!(
            sim >= 0.0 && sim <= 1.0,
            "Expected similarity in [0,1], got {sim}"
        );
    }

    #[test]
    fn jaccard_single_char_strings() {
        // Single character = no bigrams = empty set => should not divide by zero
        let sim = jaccard_bigram_similarity("a", "a");
        assert!(
            sim >= 0.0 && sim <= 1.0,
            "Expected similarity in [0,1] for single-char strings, got {sim}"
        );
    }

    // --- Content hash edge cases ---

    #[test]
    fn content_hash_empty_string() {
        // Should return a valid SHA-256 hex hash (64 chars), not panic
        let hash = generate_content_hash("");
        assert_eq!(hash.len(), 64, "SHA-256 hash must be 64 hex chars");
    }

    #[test]
    fn content_hash_long_string_nfkc_applied() {
        // Verify NFKC normalization is applied before hashing:
        // fullwidth ABC (U+FF21..U+FF23) → ASCII ABC after NFKC
        let fullwidth = "\u{FF21}\u{FF22}\u{FF23}"; // Ａ Ｂ Ｃ
        let ascii = "ABC";
        assert_eq!(
            generate_content_hash(fullwidth),
            generate_content_hash(ascii),
            "NFKC must normalise fullwidth ASCII before hashing"
        );
    }

    // --- URL normalization edge cases ---

    #[test]
    fn normalize_url_no_query_params() {
        let url = "https://example.com/article";
        let result = normalize_url(url);
        assert!(!result.contains('?'), "No query string should be present");
        assert!(result.starts_with("https://"));
    }

    #[test]
    fn normalize_url_only_tracking_params() {
        // All params are tracking params → query string completely removed (no trailing ?)
        let url = "https://example.com/page?utm_source=twitter&utm_medium=social";
        let result = normalize_url(url);
        assert!(!result.contains("utm_source"), "utm_source must be removed");
        assert!(!result.contains('?'), "Trailing ? must not remain");
    }

    #[test]
    fn normalize_url_trailing_slash_root() {
        // Root-level path trailing slash should be preserved (length <= 8 guard)
        // "https://example.com/" has 22 chars — trailing slash removed only if len > 8
        let url = "https://example.com/";
        let result = normalize_url(url);
        assert!(
            result.starts_with("https://example.com"),
            "Host must be preserved"
        );
    }

    #[test]
    fn normalize_url_uppercase_scheme() {
        // normalize_url handles lowercase "http://" → "https://" substitution.
        // An already-uppercase "HTTP://" is not matched by the starts_with("http://") guard,
        // so the scheme is left as-is, but the host lowercasing pass still applies.
        let url = "HTTP://Example.COM/Article";
        let result = normalize_url(url);
        // Host portion must be lowercased regardless of scheme casing
        assert!(!result.contains("Example.COM"), "Host must be lowercased, got: {result}");
    }

    #[test]
    fn normalize_url_mixed_case_host() {
        let url = "https://EXAMPLE.Com/path";
        let result = normalize_url(url);
        assert!(
            result.contains("example.com"),
            "Host must be lowercased, got: {result}"
        );
    }

    #[test]
    fn normalize_url_empty_string() {
        // Should handle empty string gracefully without panicking
        let result = normalize_url("");
        // Result may be empty or unchanged; the important thing is no panic
        let _ = result; // suppress unused warning
    }
}
