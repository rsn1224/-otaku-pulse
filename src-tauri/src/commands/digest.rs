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
