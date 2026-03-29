use crate::error::CmdResult;
use crate::services::settings_queries;
use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub async fn get_settings(db: State<'_, SqlitePool>) -> CmdResult<HashMap<String, String>> {
    settings_queries::load_settings(&db).await
}

#[tauri::command]
pub async fn update_setting(
    db: State<'_, SqlitePool>,
    key: String,
    value: String,
) -> CmdResult<()> {
    settings_queries::upsert_setting(&db, key, value).await
}
