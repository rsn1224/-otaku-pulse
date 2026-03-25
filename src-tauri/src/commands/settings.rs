use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::State;
use crate::error::CmdResult;

#[tauri::command]
pub async fn get_settings(db: State<'_, SqlitePool>) -> CmdResult<HashMap<String, String>> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT key, value FROM settings"
    )
    .fetch_all(&*db)
    .await
    .map_err(crate::error::AppError::from)?;

    Ok(rows.into_iter().collect())
}

#[tauri::command]
pub async fn update_setting(
    db: State<'_, SqlitePool>,
    key: String,
    value: String,
) -> CmdResult<()> {
    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .bind(&key)
    .bind(&value)
    .execute(&*db)
    .await
    .map_err(crate::error::AppError::from)?;

    Ok(())
}
