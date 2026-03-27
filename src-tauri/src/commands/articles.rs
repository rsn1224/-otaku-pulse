use crate::error::AppError;
use sqlx::SqlitePool;

#[tauri::command]
pub async fn mark_read(db: tauri::State<'_, SqlitePool>, article_id: i64) -> Result<(), AppError> {
    mark_article_read(&db, article_id).await
}

// --- Testable core logic ---

pub(crate) async fn mark_article_read(db: &SqlitePool, article_id: i64) -> Result<(), AppError> {
    sqlx::query("UPDATE articles SET is_read = 1 WHERE id = ?")
        .bind(article_id)
        .execute(db)
        .await?;

    tracing::info!("Marked article {} as read", article_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_helpers::setup_test_db;
    use sqlx::Row;

    async fn seed_article(db: &SqlitePool) -> i64 {
        sqlx::query(
            "INSERT INTO feeds (name, url, feed_type, category, created_at, updated_at)
             VALUES ('test', 'http://test', 'rss', 'anime', datetime('now'), datetime('now'))",
        )
        .execute(db)
        .await
        .unwrap();

        let result = sqlx::query(
            "INSERT INTO articles (feed_id, title, is_read)
             VALUES (1, 'Test Article', 0)",
        )
        .execute(db)
        .await
        .unwrap();

        result.last_insert_rowid()
    }

    #[tokio::test]
    async fn test_mark_read() {
        let db = setup_test_db().await;
        let article_id = seed_article(&db).await;

        mark_article_read(&db, article_id).await.unwrap();

        let row = sqlx::query("SELECT is_read FROM articles WHERE id = ?")
            .bind(article_id)
            .fetch_one(&db)
            .await
            .unwrap();
        let is_read: bool = row.get("is_read");
        assert!(is_read);
    }

    #[tokio::test]
    async fn test_mark_read_nonexistent_article_succeeds() {
        let db = setup_test_db().await;
        // UPDATE on non-existent row is a no-op, not an error
        mark_article_read(&db, 999).await.unwrap();
    }
}
