use crate::error::CmdResult;
use crate::models::DigestDto;
use crate::services::digest_queries;
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn get_digests(
    db: State<'_, SqlitePool>,
    category: Option<String>,
) -> CmdResult<Vec<DigestDto>> {
    digest_queries::list_digests(&db, category.as_deref()).await
}

#[tauri::command]
pub async fn get_latest_digest(
    db: State<'_, SqlitePool>,
    category: String,
) -> CmdResult<Option<DigestDto>> {
    digest_queries::get_latest_digest(&db, &category).await
}

#[tauri::command]
pub async fn delete_digest(db: State<'_, SqlitePool>, digest_id: i64) -> CmdResult<()> {
    digest_queries::delete_digest(&db, digest_id).await
}

#[cfg(test)]
mod tests {
    use crate::models::Digest;
    use crate::services::{digest_queries, test_helpers::setup_test_db};

    fn sample_digest(category: &str, generated_at: &str) -> Digest {
        Digest {
            id: 0,
            category: category.to_string(),
            title: format!("{category} ダイジェスト"),
            content_markdown: "# Summary".to_string(),
            content_html: None,
            article_ids: "1,2".to_string(),
            model_used: Some("test-model".to_string()),
            token_count: Some(50),
            generated_at: generated_at.to_string(),
        }
    }

    #[tokio::test]
    async fn test_get_latest_digest_returns_newest() {
        let db = setup_test_db().await;

        digest_queries::insert_digest(&db, &sample_digest("anime", "2025-01-01T00:00:00Z"))
            .await
            .unwrap();
        digest_queries::insert_digest(&db, &sample_digest("anime", "2025-01-02T00:00:00Z"))
            .await
            .unwrap();

        let latest = digest_queries::get_latest_digest(&db, "anime")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(latest.generated_at, "2025-01-02T00:00:00Z");
    }

    #[tokio::test]
    async fn test_get_latest_digest_none_for_empty_category() {
        let db = setup_test_db().await;

        let result = digest_queries::get_latest_digest(&db, "manga")
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete_digest_removes_entry() {
        let db = setup_test_db().await;

        let id = digest_queries::insert_digest(&db, &sample_digest("game", "2025-01-01T00:00:00Z"))
            .await
            .unwrap();

        digest_queries::delete_digest(&db, id).await.unwrap();

        let digests = digest_queries::list_digests(&db, Some("game"))
            .await
            .unwrap();
        assert!(digests.is_empty());
    }

    #[tokio::test]
    async fn test_list_digests_filters_by_category() {
        let db = setup_test_db().await;

        digest_queries::insert_digest(&db, &sample_digest("anime", "2025-01-01T00:00:00Z"))
            .await
            .unwrap();
        digest_queries::insert_digest(&db, &sample_digest("game", "2025-01-01T00:00:00Z"))
            .await
            .unwrap();

        let anime = digest_queries::list_digests(&db, Some("anime"))
            .await
            .unwrap();
        assert_eq!(anime.len(), 1);

        let all = digest_queries::list_digests(&db, None).await.unwrap();
        assert_eq!(all.len(), 2);
    }
}
