use crate::error::AppError;
use crate::models::DiscoverArticleDto;
use sqlx::SqlitePool;

/// トレンドキーワード抽出の最小単語長
const MIN_KEYWORD_LENGTH: usize = 4;
/// トレンドキーワードとして採用する最小出現回数
const MIN_KEYWORD_COUNT: i64 = 3;

const STOP_WORDS: &[&str] = &[
    "the", "and", "for", "that", "this", "with", "from", "your", "have", "are", "was", "will",
    "can", "has", "more", "about", "into", "than", "its", "been", "most", "just", "over", "also",
    "after", "http", "https", "www", "html", "nbsp",
];

pub(crate) fn is_stop_word(word: &str) -> bool {
    STOP_WORDS.contains(&word)
}

pub(crate) fn parse_numbered_lines(raw: &str, expected: usize) -> Vec<String> {
    let lines: Vec<String> = raw
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| {
            // "1. 理由" → "理由"
            let trimmed = l.trim();
            if let Some(idx) = trimmed.find(". ") {
                trimmed[idx + 2..].to_string()
            } else {
                trimmed.to_string()
            }
        })
        .collect();

    let mut result = lines;
    while result.len() < expected {
        result.push("注目".to_string());
    }
    result.truncate(expected);
    result
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightEntry {
    pub article: DiscoverArticleDto,
    pub reason: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendKeyword {
    pub keyword: String,
    pub count: i64,
}

pub async fn get_trending_keywords(db: &SqlitePool) -> Result<Vec<TrendKeyword>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT title FROM articles
         WHERE is_duplicate = 0
           AND published_at >= datetime('now', '-3 days')
         ORDER BY published_at DESC
         LIMIT 500",
    )
    .fetch_all(db)
    .await?;

    let mut word_counts: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for (title,) in &rows {
        for word in title.split(|c: char| !c.is_alphanumeric() && c != '\'' && c != '-') {
            let w = word.trim().to_lowercase();
            if w.len() >= MIN_KEYWORD_LENGTH && !is_stop_word(&w) {
                *word_counts.entry(w).or_insert(0) += 1;
            }
        }
    }

    let mut keywords: Vec<TrendKeyword> = word_counts
        .into_iter()
        .filter(|(_, count)| *count >= MIN_KEYWORD_COUNT)
        .map(|(keyword, count)| TrendKeyword { keyword, count })
        .collect();

    keywords.sort_by(|a, b| b.count.cmp(&a.count));
    keywords.truncate(8);

    Ok(keywords)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_helpers::setup_test_db;

    #[test]
    fn parse_numbered_lines_extracts_items() {
        let raw = "1. First\n2. Second\n3. Third";
        let result = parse_numbered_lines(raw, 3);
        assert_eq!(result, vec!["First", "Second", "Third"]);
    }

    #[test]
    fn parse_numbered_lines_pads_missing() {
        let result = parse_numbered_lines("1. Only one", 3);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], "Only one");
        assert_eq!(result[1], "注目");
    }

    #[tokio::test]
    async fn get_trending_keywords_returns_empty_for_no_articles() {
        let db = setup_test_db().await;
        let keywords = get_trending_keywords(&db).await.unwrap();
        assert!(keywords.is_empty());
    }

    #[tokio::test]
    async fn get_trending_keywords_extracts_repeated_words() {
        let db = setup_test_db().await;

        sqlx::query(
            "INSERT INTO feeds (id, name, url, feed_type, category, created_at, updated_at)
             VALUES (1, 'test', 'http://test', 'rss', 'anime', datetime('now'), datetime('now'))",
        )
        .execute(&db)
        .await
        .unwrap();

        // 同じキーワード "pokemon" を3回以上含む記事を挿入
        for i in 0..4 {
            sqlx::query(
                "INSERT INTO articles (feed_id, title, published_at, created_at)
                 VALUES (1, ?1, datetime('now'), datetime('now'))",
            )
            .bind(format!("Pokemon news update {i}"))
            .execute(&db)
            .await
            .unwrap();
        }

        let keywords = get_trending_keywords(&db).await.unwrap();
        let has_pokemon = keywords.iter().any(|k| k.keyword == "pokemon");
        assert!(has_pokemon, "Expected 'pokemon' in trending: {:?}", keywords);
    }
}
