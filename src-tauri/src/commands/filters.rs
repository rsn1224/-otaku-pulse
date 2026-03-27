use crate::error::{AppError, CmdResult};
use sqlx::{Row, SqlitePool};
use tauri::State;

const VALID_FILTER_TYPES: &[&str] = &["mute", "highlight"];
const MAX_KEYWORD_LENGTH: usize = 200;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeywordFilter {
    pub id: i64,
    pub keyword: String,
    pub filter_type: String,
    pub category: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub async fn get_keyword_filters(db: State<'_, SqlitePool>) -> CmdResult<Vec<KeywordFilter>> {
    list_filters(&db).await
}

#[tauri::command]
pub async fn add_keyword_filter(
    db: State<'_, SqlitePool>,
    keyword: String,
    filter_type: String,
    category: Option<String>,
) -> CmdResult<KeywordFilter> {
    insert_filter(&db, keyword, filter_type, category).await
}

#[tauri::command]
pub async fn remove_keyword_filter(db: State<'_, SqlitePool>, id: i64) -> CmdResult<()> {
    delete_filter(&db, id).await
}

// --- Testable core logic ---

pub(crate) async fn list_filters(db: &SqlitePool) -> Result<Vec<KeywordFilter>, AppError> {
    let filters = sqlx::query(
        "SELECT id, keyword, filter_type, category, created_at
         FROM keyword_filters
         ORDER BY created_at DESC",
    )
    .fetch_all(db)
    .await?;

    let dtos = filters
        .into_iter()
        .map(|row| KeywordFilter {
            id: row.get("id"),
            keyword: row.get("keyword"),
            filter_type: row.get("filter_type"),
            category: row.get("category"),
            created_at: row.get("created_at"),
        })
        .collect();

    Ok(dtos)
}

pub(crate) async fn insert_filter(
    db: &SqlitePool,
    keyword: String,
    filter_type: String,
    category: Option<String>,
) -> Result<KeywordFilter, AppError> {
    let keyword = keyword.trim().to_string();
    if keyword.is_empty() || keyword.len() > MAX_KEYWORD_LENGTH {
        return Err(AppError::InvalidInput(format!(
            "キーワードは1〜{}文字で入力してください",
            MAX_KEYWORD_LENGTH
        )));
    }
    if !VALID_FILTER_TYPES.contains(&filter_type.as_str()) {
        return Err(AppError::InvalidInput(format!(
            "無効なフィルタータイプ: {}（有効: {}）",
            filter_type,
            VALID_FILTER_TYPES.join(", ")
        )));
    }

    let result = sqlx::query(
        "INSERT INTO keyword_filters (keyword, filter_type, category)
         VALUES (?, ?, ?)",
    )
    .bind(&keyword)
    .bind(&filter_type)
    .bind(&category)
    .execute(db)
    .await?;

    let id = result.last_insert_rowid();

    let filter = sqlx::query(
        "SELECT id, keyword, filter_type, category, created_at
         FROM keyword_filters
         WHERE id = ?",
    )
    .bind(id)
    .fetch_one(db)
    .await?;

    Ok(KeywordFilter {
        id: filter.get("id"),
        keyword: filter.get("keyword"),
        filter_type: filter.get("filter_type"),
        category: filter.get("category"),
        created_at: filter.get("created_at"),
    })
}

pub(crate) async fn delete_filter(db: &SqlitePool, id: i64) -> Result<(), AppError> {
    sqlx::query("DELETE FROM keyword_filters WHERE id = ?")
        .bind(id)
        .execute(db)
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_helpers::setup_test_db;

    #[tokio::test]
    async fn test_add_and_list_filters() {
        let db = setup_test_db().await;

        let filter = insert_filter(&db, "spoiler".into(), "mute".into(), None)
            .await
            .unwrap();
        assert_eq!(filter.keyword, "spoiler");
        assert_eq!(filter.filter_type, "mute");
        assert!(filter.category.is_none());

        let filters = list_filters(&db).await.unwrap();
        assert_eq!(filters.len(), 1);
        assert_eq!(filters[0].keyword, "spoiler");
    }

    #[tokio::test]
    async fn test_add_filter_with_category() {
        let db = setup_test_db().await;

        let filter = insert_filter(&db, "isekai".into(), "highlight".into(), Some("anime".into()))
            .await
            .unwrap();
        assert_eq!(filter.filter_type, "highlight");
        assert_eq!(filter.category.as_deref(), Some("anime"));
    }

    #[tokio::test]
    async fn test_remove_filter() {
        let db = setup_test_db().await;

        let filter = insert_filter(&db, "test".into(), "mute".into(), None)
            .await
            .unwrap();
        delete_filter(&db, filter.id).await.unwrap();

        let filters = list_filters(&db).await.unwrap();
        assert!(filters.is_empty());
    }

    #[tokio::test]
    async fn test_reject_empty_keyword() {
        let db = setup_test_db().await;

        let err = insert_filter(&db, "".into(), "mute".into(), None)
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn test_reject_whitespace_only_keyword() {
        let db = setup_test_db().await;

        let err = insert_filter(&db, "   ".into(), "mute".into(), None)
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn test_reject_too_long_keyword() {
        let db = setup_test_db().await;

        let long = "a".repeat(MAX_KEYWORD_LENGTH + 1);
        let err = insert_filter(&db, long, "mute".into(), None)
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn test_reject_invalid_filter_type() {
        let db = setup_test_db().await;

        let err = insert_filter(&db, "test".into(), "invalid".into(), None)
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn test_keyword_is_trimmed() {
        let db = setup_test_db().await;

        let filter = insert_filter(&db, "  trimmed  ".into(), "mute".into(), None)
            .await
            .unwrap();
        assert_eq!(filter.keyword, "trimmed");
    }
}
