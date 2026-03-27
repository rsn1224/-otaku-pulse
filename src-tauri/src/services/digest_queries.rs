use crate::error::AppError;
use crate::models::{Article, DigestDto};
#[cfg(test)]
use crate::models::Digest;
use sqlx::{Row, SqlitePool};

fn row_to_digest_dto(row: sqlx::sqlite::SqliteRow) -> DigestDto {
    let article_ids: String = row.get("article_ids");
    let article_count = if article_ids.is_empty() {
        0
    } else {
        article_ids.split(',').count()
    };
    DigestDto {
        id: row.get("id"),
        category: row.get("category"),
        title: row.get("title"),
        content_markdown: row.get("content_markdown"),
        content_html: row.get("content_html"),
        article_count,
        model_used: row.get("model_used"),
        generated_at: row.get("generated_at"),
    }
}

pub async fn list_digests(
    db: &SqlitePool,
    category: Option<&str>,
) -> Result<Vec<DigestDto>, AppError> {
    let rows = if let Some(cat) = category {
        sqlx::query("SELECT * FROM digests WHERE category = ? ORDER BY generated_at DESC")
            .bind(cat)
            .fetch_all(db)
            .await?
    } else {
        sqlx::query("SELECT * FROM digests ORDER BY generated_at DESC")
            .fetch_all(db)
            .await?
    };

    Ok(rows.into_iter().map(row_to_digest_dto).collect())
}

#[cfg(test)]
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

pub async fn unsummarized_articles(
    db: &SqlitePool,
    category: &str,
    limit: i64,
) -> Result<Vec<Article>, AppError> {
    let cutoff = (chrono::Utc::now() - chrono::Duration::hours(24)).to_rfc3339();

    let rows = sqlx::query_as::<_, Article>(
        "SELECT a.id, a.feed_id, a.external_id, a.title, a.url, a.url_normalized,
                a.content, a.summary, a.author, a.published_at, a.importance_score,
                a.is_read, a.is_bookmarked, a.is_duplicate, a.duplicate_of,
                a.language, a.thumbnail_url, a.content_hash, a.metadata, a.created_at
         FROM articles a JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_duplicate = 0 AND a.content IS NOT NULL
           AND f.category = ? AND a.created_at > ?
         ORDER BY a.published_at DESC LIMIT ?",
    )
    .bind(category)
    .bind(&cutoff)
    .bind(limit)
    .fetch_all(db)
    .await?;

    Ok(rows)
}

pub async fn delete_digest(db: &SqlitePool, digest_id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM digests WHERE id = ?")
        .bind(digest_id)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

    Ok(())
}

pub async fn get_latest_digest(
    db: &SqlitePool,
    category: &str,
) -> Result<Option<DigestDto>, AppError> {
    let row =
        sqlx::query("SELECT * FROM digests WHERE category = ? ORDER BY generated_at DESC LIMIT 1")
            .bind(category)
            .fetch_optional(db)
            .await?;

    Ok(row.map(row_to_digest_dto))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_helpers::setup_test_db;

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
        let digests = list_digests(&db, Some("anime")).await.unwrap();
        assert_eq!(digests.len(), 1);
        assert_eq!(digests[0].category, "anime");
        assert_eq!(digests[0].title, "アニメダイジェスト");
    }

    #[tokio::test]
    async fn test_unsummarized_articles() {
        let db = setup_test_db().await;

        sqlx::query("INSERT INTO feeds (id, name, url, feed_type, category, created_at, updated_at) VALUES (1, 'test', 'http://example.com', 'rss', 'anime', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')")
            .execute(&db).await.unwrap();
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
