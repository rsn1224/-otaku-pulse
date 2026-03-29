use crate::error::AppError;
use crate::services::article_queries;
use sqlx::SqlitePool;

#[tauri::command]
pub async fn mark_read(db: tauri::State<'_, SqlitePool>, article_id: i64) -> Result<(), AppError> {
    article_queries::mark_article_read(&db, article_id).await
}
