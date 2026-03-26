#![allow(dead_code)]
use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest};
use crate::models::DiscoverArticleDto;
use sqlx::SqlitePool;

pub async fn get_daily_highlights(
    db: &SqlitePool,
    llm: &dyn LlmClient,
) -> Result<Vec<HighlightEntry>, AppError> {
    let articles = sqlx::query_as::<_, DiscoverArticleDto>(
        "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author, \
                a.published_at, a.is_read, a.is_bookmarked, a.language, \
                a.thumbnail_url, a.ai_summary, \
                f.name AS feed_name, f.category AS category, \
                COALESCE(s.total_score, a.importance_score) AS total_score \
         FROM articles a JOIN feeds f ON a.feed_id = f.id \
         LEFT JOIN article_scores s ON a.id = s.article_id \
         WHERE a.is_duplicate = 0 AND a.published_at >= datetime('now', '-24 hours') \
         ORDER BY COALESCE(s.total_score, a.importance_score) DESC LIMIT 5",
    )
    .fetch_all(db)
    .await?;

    if articles.is_empty() {
        return Ok(vec![]);
    }

    let title_list = articles
        .iter()
        .enumerate()
        .map(|(i, a)| format!("{}. {}", i + 1, a.title))
        .collect::<Vec<_>>()
        .join("\n");

    let req = LlmRequest::simple(
        "あなたはオタクニュースのキュレーターです。\
            各記事に対して「なぜ注目すべきか」を15文字以内で1行ずつ生成してください。\
            番号付きで返してください。余計な説明は不要です。\
            例:\n1. 10年ぶりの続編発表\n2. Steam同接記録更新"
            .to_string(),
        format!("以下の記事のハイライト理由を生成:\n{}", title_list),
        200,
    );

    let response = llm.complete(req).await;

    let reasons = match response {
        Ok(r) => parse_numbered_lines(&r.content, articles.len()),
        Err(_) => vec!["注目".to_string(); articles.len()],
    };

    let highlights = articles
        .into_iter()
        .zip(reasons.into_iter())
        .map(|(article, reason)| HighlightEntry { article, reason })
        .collect();

    Ok(highlights)
}

pub async fn batch_generate_summaries(
    db: &SqlitePool,
    llm: &dyn LlmClient,
    limit: i64,
) -> Result<u32, AppError> {
    let rows: Vec<(i64, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT a.id, a.title, a.summary, a.content
         FROM articles a
         LEFT JOIN article_scores s ON a.id = s.article_id
         WHERE a.is_duplicate = 0
           AND a.ai_summary IS NULL
           AND a.published_at >= datetime('now', '-48 hours')
         ORDER BY COALESCE(s.total_score, a.importance_score) DESC
         LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(db)
    .await?;

    let mut generated = 0u32;

    for (id, title, summary, content) in &rows {
        let source_text = content.as_deref().or(summary.as_deref()).unwrap_or("");

        if source_text.is_empty() {
            continue;
        }

        let req = LlmRequest::simple(
            "与えられたテキストだけを使って日本語で2文の要約を書いてください。\
                外部検索は使わないこと。謝罪や注釈は書かないこと。"
                .to_string(),
            format!(
                "タイトル: {}\n\n本文: {}",
                title,
                &source_text[..source_text.len().min(1200)]
            ),
            150,
        );

        match llm.complete(req).await {
            Ok(response) => {
                let ai_summary = response.content.trim().to_string();
                let _ = sqlx::query(
                    "UPDATE articles SET ai_summary = ?1, ai_summary_generated_at = datetime('now')
                     WHERE id = ?2",
                )
                .bind(&ai_summary)
                .bind(id)
                .execute(db)
                .await;
                generated += 1;
            }
            Err(e) => {
                tracing::warn!(article_id = id, error = %e, "Batch summary generation failed");
                break; // LLM エラーなら残りもスキップ
            }
        }
    }

    tracing::info!(count = generated, "Batch summary generation completed");
    Ok(generated)
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
            if w.len() >= 4 && !is_stop_word(&w) {
                *word_counts.entry(w).or_insert(0) += 1;
            }
        }
    }

    let mut keywords: Vec<TrendKeyword> = word_counts
        .into_iter()
        .filter(|(_, count)| *count >= 3)
        .map(|(keyword, count)| TrendKeyword { keyword, count })
        .collect();

    keywords.sort_by(|a, b| b.count.cmp(&a.count));
    keywords.truncate(8);

    Ok(keywords)
}

const STOP_WORDS: &[&str] = &[
    "the", "and", "for", "that", "this", "with", "from", "your", "have", "are", "was", "will",
    "can", "has", "more", "about", "into", "than", "its", "been", "most", "just", "over", "also",
    "after", "http", "https", "www", "html", "nbsp",
];

fn is_stop_word(word: &str) -> bool {
    STOP_WORDS.contains(&word)
}

fn parse_numbered_lines(raw: &str, expected: usize) -> Vec<String> {
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
