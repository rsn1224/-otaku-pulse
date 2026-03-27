use crate::error::AppError;
use sqlx::SqlitePool;

#[tauri::command]
pub async fn mark_read(db: tauri::State<'_, SqlitePool>, article_id: i64) -> Result<(), AppError> {
    sqlx::query("UPDATE articles SET is_read = 1 WHERE id = ?")
        .bind(article_id)
        .execute(&*db)
        .await?;

    tracing::info!("Marked article {} as read", article_id);
    Ok(())
}
