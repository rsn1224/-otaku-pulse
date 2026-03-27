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
