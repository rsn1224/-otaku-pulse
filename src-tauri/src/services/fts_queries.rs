use crate::error::AppError;
use crate::models::ArticleDto;
use sqlx::SqlitePool;

/// FTS5 クエリ文字列をサニタイズする。
/// 特殊文字の除去、演算子キーワード (AND/OR/NOT/NEAR) の除去、プレフィックス検索用の `*` 付与を行う。
/// 空文字列やサニタイズ後に空になる場合は `None` を返す。
pub fn sanitize_fts_query(query: &str) -> Option<String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return None;
    }
    let sanitized: String = trimmed.replace(['"', '(', ')', '*', '^'], "");
    let fts_query = sanitized
        .split_whitespace()
        .filter(|w| !matches!(w.to_uppercase().as_str(), "AND" | "OR" | "NOT" | "NEAR"))
        .collect::<Vec<_>>()
        .join(" ");
    if fts_query.is_empty() {
        return None;
    }
    Some(format!("{fts_query}*"))
}

/// 全文検索 (FTS5) with subquery-based pagination (PERF-04)
///
/// Uses a subquery `SELECT rowid FROM articles_fts WHERE ... LIMIT ? OFFSET ?` to
/// prevent FTS from loading all matches into memory before the JOIN. Pass `offset = 0`
/// for the first page (backward-compatible default for existing call sites).
pub async fn search_articles(
    db: &SqlitePool,
    query: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<ArticleDto>, AppError> {
    let fts_query = match sanitize_fts_query(query) {
        Some(q) => q,
        None => return Ok(vec![]),
    };

    let rows = sqlx::query_as::<_, ArticleDto>(
        "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author,
         a.published_at, a.importance_score, a.is_read, a.is_bookmarked,
         a.language, a.thumbnail_url, f.name as feed_name
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.id IN (
             SELECT rowid FROM articles_fts
             WHERE articles_fts MATCH ?
             ORDER BY rank
             LIMIT ? OFFSET ?
         )
         ORDER BY a.published_at DESC",
    )
    .bind(fts_query)
    .bind(limit)
    .bind(offset)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_empty_string_returns_none() {
        assert_eq!(sanitize_fts_query(""), None);
        assert_eq!(sanitize_fts_query("   "), None);
    }

    #[test]
    fn sanitize_removes_special_chars() {
        assert_eq!(sanitize_fts_query("hello\"world"), Some("helloworld*".into()));
        assert_eq!(sanitize_fts_query("(test)"), Some("test*".into()));
        assert_eq!(sanitize_fts_query("foo*bar^baz"), Some("foobarbaz*".into()));
    }

    #[test]
    fn sanitize_removes_fts_operators() {
        assert_eq!(sanitize_fts_query("cats AND dogs"), Some("cats dogs*".into()));
        assert_eq!(sanitize_fts_query("NOT bad"), Some("bad*".into()));
        assert_eq!(sanitize_fts_query("foo OR bar"), Some("foo bar*".into()));
        assert_eq!(sanitize_fts_query("NEAR word"), Some("word*".into()));
    }

    #[test]
    fn sanitize_operators_case_insensitive() {
        assert_eq!(sanitize_fts_query("and or not near"), None);
        assert_eq!(sanitize_fts_query("And Or Not Near"), None);
    }

    #[test]
    fn sanitize_returns_none_when_only_operators() {
        assert_eq!(sanitize_fts_query("AND OR NOT"), None);
    }

    #[test]
    fn sanitize_normal_query_appends_wildcard() {
        assert_eq!(sanitize_fts_query("anime"), Some("anime*".into()));
        assert_eq!(
            sanitize_fts_query("pokemon new game"),
            Some("pokemon new game*".into())
        );
    }

    #[test]
    fn sanitize_trims_whitespace() {
        assert_eq!(sanitize_fts_query("  hello  "), Some("hello*".into()));
    }

    #[test]
    fn sanitize_japanese_text() {
        assert_eq!(
            sanitize_fts_query("ポケモン 新作"),
            Some("ポケモン 新作*".into())
        );
    }
}
