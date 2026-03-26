#![allow(dead_code)]
use crate::error::AppError;
use crate::models::{Article, Digest, DigestDto};
use sqlx::{Row, SqlitePool};

/// ダイジェスト一覧を取得する
pub async fn list_digests(
    db: &SqlitePool,
    category: Option<&str>,
) -> Result<Vec<DigestDto>, AppError> {
    let digests = if let Some(cat) = category {
        sqlx::query(
            "SELECT id, category, title, content_markdown, content_html, 
                    article_ids, model_used, token_count, generated_at 
                    FROM digests WHERE category = ? ORDER BY generated_at DESC",
        )
        .bind(cat)
        .fetch_all(db)
        .await
        .map_err(AppError::Database)?
    } else {
        sqlx::query(
            "SELECT id, category, title, content_markdown, content_html, 
                    article_ids, model_used, token_count, generated_at 
                    FROM digests ORDER BY generated_at DESC",
        )
        .fetch_all(db)
        .await
        .map_err(AppError::Database)?
    };

    let mut digest_dtos = Vec::new();
    for row in digests {
        let article_ids: String = row.get("article_ids");
        let article_count = if article_ids.is_empty() {
            0
        } else {
            article_ids.split(',').count()
        };

        let digest = DigestDto {
            id: row.get("id"),
            category: row.get("category"),
            title: row.get("title"),
            content_markdown: row.get("content_markdown"),
            content_html: row.get("content_html"),
            article_count,
            model_used: row.get("model_used"),
            generated_at: row.get("generated_at"),
        };
        digest_dtos.push(digest);
    }

    Ok(digest_dtos)
}

/// ダイジェストを挿入する
#[allow(dead_code)]
pub async fn insert_digest(db: &SqlitePool, digest: &Digest) -> Result<i64, AppError> {
    let result = sqlx::query(
        "INSERT INTO digests (category, title, content_markdown, content_html, 
                              article_ids, model_used, token_count, generated_at) 
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&digest.category)
    .bind(&digest.title)
    .bind(&digest.content_markdown)
    .bind(&digest.content_html)
    .bind(&digest.article_ids)
    .bind(&digest.model_used)
    .bind(digest.token_count)
    .bind(&digest.generated_at)
    .execute(db)
    .await
    .map_err(AppError::Database)?;

    Ok(result.last_insert_rowid())
}

/// 未要約の記事を取得する
pub async fn unsummarized_articles(
    db: &SqlitePool,
    category: &str,
    limit: i64,
) -> Result<Vec<Article>, AppError> {
    // 24時間前のタイムスタンプを計算
    let now = chrono::Utc::now();
    let twenty_four_hours_ago = (now - chrono::Duration::hours(24)).to_rfc3339();

    let rows = sqlx::query(
        "SELECT a.id, a.feed_id, a.external_id, a.title, a.url, a.url_normalized,
                           a.content, a.summary, a.author, a.published_at, a.importance_score,
                           a.is_read, a.is_bookmarked, a.is_duplicate, a.duplicate_of,
                           a.language, a.thumbnail_url, a.content_hash, a.metadata, a.created_at
                           FROM articles a
                           JOIN feeds f ON a.feed_id = f.id
                           WHERE a.is_duplicate = 0 
                           AND a.content IS NOT NULL
                           AND f.category = ?
                           AND a.created_at > ?
                           ORDER BY a.published_at DESC
                           LIMIT ?",
    )
    .bind(category)
    .bind(&twenty_four_hours_ago)
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let mut articles = Vec::new();
    for row in rows {
        let article = Article {
            id: row.get("id"),
            feed_id: row.get("feed_id"),
            external_id: row.get("external_id"),
            title: row.get("title"),
            url: row.get("url"),
            url_normalized: row.get("url_normalized"),
            content: row.get("content"),
            summary: row.get("summary"),
            author: row.get("author"),
            published_at: row.get("published_at"),
            importance_score: row.get("importance_score"),
            is_read: row.get("is_read"),
            is_bookmarked: row.get("is_bookmarked"),
            is_duplicate: row.get("is_duplicate"),
            duplicate_of: row.get("duplicate_of"),
            language: row.get("language"),
            thumbnail_url: row.get("thumbnail_url"),
            content_hash: row.get("content_hash"),
            metadata: row.get("metadata"),
            created_at: row.get("created_at"),
        };
        articles.push(article);
    }

    Ok(articles)
}

/// ダイジェストを削除する
pub async fn delete_digest(db: &SqlitePool, digest_id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM digests WHERE id = ?")
        .bind(digest_id)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

    Ok(())
}

/// 指定カテゴリーの最新ダイジェストを取得する
pub async fn get_latest_digest(
    db: &SqlitePool,
    category: &str,
) -> Result<Option<DigestDto>, AppError> {
    let row = sqlx::query(
        "SELECT id, category, title, content_markdown, content_html, 
                          article_ids, model_used, token_count, generated_at 
                          FROM digests WHERE category = ? ORDER BY generated_at DESC LIMIT 1",
    )
    .bind(category)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    if let Some(row) = row {
        let article_ids: String = row.get("article_ids");
        let article_count = if article_ids.is_empty() {
            0
        } else {
            article_ids.split(',').count()
        };

        let digest = DigestDto {
            id: row.get("id"),
            category: row.get("category"),
            title: row.get("title"),
            content_markdown: row.get("content_markdown"),
            content_html: row.get("content_html"),
            article_count,
            model_used: row.get("model_used"),
            generated_at: row.get("generated_at"),
        };
        Ok(Some(digest))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();

        // テーブルを作成
        sqlx::query(
            "CREATE TABLE feeds (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            feed_type TEXT NOT NULL,
            category TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            last_fetched_at TEXT,
            consecutive_errors INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            disabled_reason TEXT,
            etag TEXT,
            last_modified TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE articles (
            id INTEGER PRIMARY KEY,
            feed_id INTEGER NOT NULL,
            external_id TEXT,
            title TEXT NOT NULL,
            url TEXT,
            url_normalized TEXT,
            content TEXT,
            summary TEXT,
            author TEXT,
            published_at TEXT,
            importance_score REAL NOT NULL DEFAULT 0.0,
            is_read BOOLEAN NOT NULL DEFAULT 0,
            is_bookmarked BOOLEAN NOT NULL DEFAULT 0,
            is_duplicate BOOLEAN NOT NULL DEFAULT 0,
            duplicate_of INTEGER,
            language TEXT,
            thumbnail_url TEXT,
            content_hash TEXT,
            metadata TEXT,
            created_at TEXT NOT NULL
        )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE digests (
            id INTEGER PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            content_markdown TEXT NOT NULL,
            content_html TEXT,
            article_ids TEXT,
            model_used TEXT,
            token_count INTEGER,
            generated_at TEXT NOT NULL
        )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_insert_digest() {
        let db = setup_test_db().await;

        let digest = Digest {
            id: 0,
            category: "anime".to_string(),
            title: "アニメダイジェスト".to_string(),
            content_markdown: "# テスト\n\n内容".to_string(),
            content_html: Some("<h1>テスト</h1><p>内容</p>".to_string()),
            article_ids: "1,2,3,4,5".to_string(),
            model_used: Some("qwen2.5:7b-instruct".to_string()),
            token_count: Some(100),
            generated_at: "2023-01-01T00:00:00Z".to_string(),
        };

        let id = insert_digest(&db, &digest).await.unwrap();
        assert!(id > 0);
    }

    #[tokio::test]
    async fn test_list_digests() {
        let db = setup_test_db().await;

        // テストデータを挿入
        let digest = Digest {
            id: 0,
            category: "anime".to_string(),
            title: "アニメダイジェスト".to_string(),
            content_markdown: "# テスト\n\n内容".to_string(),
            content_html: Some("<h1>テスト</h1><p>内容</p>".to_string()),
            article_ids: "1,2,3,4,5".to_string(),
            model_used: Some("qwen2.5:7b-instruct".to_string()),
            token_count: Some(100),
            generated_at: "2023-01-01T00:00:00Z".to_string(),
        };

        insert_digest(&db, &digest).await.unwrap();

        // 一覧を取得
        let digests = list_digests(&db, Some("anime")).await.unwrap();
        assert_eq!(digests.len(), 1);
        assert_eq!(digests[0].category, "anime");
        assert_eq!(digests[0].title, "アニメダイジェスト");
    }

    #[tokio::test]
    async fn test_unsummarized_articles() {
        let db = setup_test_db().await;

        // フィードを挿入
        sqlx::query("INSERT INTO feeds (id, name, url, feed_type, category, created_at, updated_at) 
                    VALUES (1, 'test', 'http://example.com', 'rss', 'anime', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')")
            .execute(&db).await.unwrap();

        // 記事を挿入（24時間以内）
        let now = chrono::Utc::now();
        let recent_time = (now - chrono::Duration::minutes(1)).to_rfc3339();

        sqlx::query(
            "INSERT INTO articles (feed_id, title, content, created_at) 
                    VALUES (1, 'テスト記事', 'テスト内容', ?)",
        )
        .bind(&recent_time)
        .execute(&db)
        .await
        .unwrap();

        let articles = unsummarized_articles(&db, "anime", 10).await.unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "テスト記事");
    }
}
