use crate::error::AppError;
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use std::collections::HashSet;
use unicode_normalization::UnicodeNormalization;

/// Layer 1: URL 正規化
pub fn normalize_url(url: &str) -> String {
    // 1. パース（url クレートまたは手動）
    let mut normalized = url.to_string();

    // 2. http → https
    if normalized.starts_with("http://") {
        normalized = normalized.replacen("http://", "https://", 1);
    }

    // 3. www. 除去
    if normalized.starts_with("https://www.") {
        normalized = normalized.replacen("https://www.", "https://", 1);
    }

    // 4. フラグメント(#)除去
    if let Some(fragment_pos) = normalized.find('#') {
        normalized.truncate(fragment_pos);
    }

    // 5. 末尾スラッシュ除去
    if normalized.ends_with('/') && normalized.len() > 8 {
        // "https://".len() + 1
        normalized.pop();
    }

    // 6. クエリパラメータ処理
    if let Some(query_pos) = normalized.find('?') {
        let base_url = &normalized[..query_pos];
        let query = &normalized[query_pos + 1..];

        // トラッキングパラメータを除去
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

        let mut filtered_params = Vec::new();
        for param in query.split('&') {
            if let Some(key) = param.split_once('=') {
                if !tracking_params.contains(&key.0) {
                    filtered_params.push(param);
                }
            } else {
                filtered_params.push(param);
            }
        }

        // パラメータをソート
        filtered_params.sort();

        if !filtered_params.is_empty() {
            normalized = format!("{}?{}", base_url, filtered_params.join("&"));
        } else {
            normalized = base_url.to_string();
        }
    }

    // 7. 小文字化（ホスト部分のみ）
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

/// Layer 2 前処理: タイトル正規化
pub fn normalize_title(title: &str) -> String {
    // 1. NFKC 正規化（全角英数→半角、半角カナ→全角）
    let normalized = title.nfc().collect::<String>();

    // 2. 記号除去: 「」『』【】（）()[]<>・、。,.!? を除去
    let symbols = [
        '「', '」', '『', '』', '【', '】', '（', '）', '(', ')', '[', ']', '<', '>', '・', '、',
        '。', ',', '.', '!', '?', '！', '？', '　',
    ];
    let mut result = String::new();
    for c in normalized.chars() {
        if !symbols.contains(&c) {
            result.push(c);
        }
    }

    // 3. 小文字化
    result = result.to_lowercase();

    // 4. 連続空白を単一スペースに
    while result.contains("  ") {
        result = result.replace("  ", " ");
    }

    // 5. trim
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

/// 重複チェック：URLとコンテンツハッシュで検索
#[allow(dead_code)]
pub async fn is_duplicate(
    db: &SqlitePool,
    url: &str,
    content_hash: &str,
) -> Result<bool, AppError> {
    // 1. URLで検索
    let url_exists = sqlx::query("SELECT id FROM articles WHERE url = ? LIMIT 1")
        .bind(url)
        .fetch_optional(db)
        .await?;
    
    if url_exists.is_some() {
        return Ok(true);
    }
    
    // 2. content_hashで検索
    let hash_exists = sqlx::query("SELECT id FROM articles WHERE content_hash = ? LIMIT 1")
        .bind(content_hash)
        .fetch_optional(db)
        .await?;
    
    Ok(hash_exists.is_some())
}

// UPSERT SQL は Round 4 の feed_queries.rs で実装

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
