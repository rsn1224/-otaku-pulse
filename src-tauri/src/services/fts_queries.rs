use crate::error::AppError;
use crate::models::ArticleDto;
use sqlx::SqlitePool;

/// Task 1: 全文検索 (FTS5)
pub async fn search_articles(
    db: &SqlitePool,
    query: &str,
    limit: i64,
) -> Result<Vec<ArticleDto>, AppError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }
    // FTS5 特殊文字を除去してプレフィックス検索に対応させる
    let sanitized: String = trimmed
        .replace(['"', '(', ')', '*', '^'], "");
    // FTS5 演算子キーワードを除去
    let fts_query = sanitized
        .split_whitespace()
        .filter(|w| !matches!(w.to_uppercase().as_str(), "AND" | "OR" | "NOT" | "NEAR"))
        .collect::<Vec<_>>()
        .join(" ");
    if fts_query.is_empty() {
        return Ok(vec![]);
    }
    let fts_query = format!("{fts_query}*");

    let rows = sqlx::query_as::<_, ArticleDto>(
        "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author,
         a.published_at, a.importance_score, a.is_read, a.is_bookmarked,
         a.language, a.thumbnail_url, f.name as feed_name
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN articles_fts fts ON a.id = fts.rowid
         WHERE articles_fts MATCH ?
         ORDER BY rank
         LIMIT ?",
    )
    .bind(fts_query)
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(|e| {
        // FTS MATCH クエリエラーの場合は FeedParse でラップ
        if e.to_string().contains("fts5") || e.to_string().contains("syntax") {
            AppError::FeedParse(format!("Invalid search query: {}", e))
        } else {
            e.into()
        }
    })?;

    Ok(rows)
}
