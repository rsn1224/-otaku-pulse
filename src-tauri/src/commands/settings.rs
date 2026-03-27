use crate::error::{AppError, CmdResult};
use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::State;

const MAX_KEY_LENGTH: usize = 100;
const MAX_VALUE_LENGTH: usize = 10_000;

#[tauri::command]
pub async fn get_settings(db: State<'_, SqlitePool>) -> CmdResult<HashMap<String, String>> {
    let rows = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings")
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
    let key = key.trim().to_string();
    if key.is_empty() || key.len() > MAX_KEY_LENGTH {
        return Err(AppError::InvalidInput(format!(
            "設定キーは1〜{}文字で入力してください",
            MAX_KEY_LENGTH
        )));
    }
    if value.len() > MAX_VALUE_LENGTH {
        return Err(AppError::InvalidInput(format!(
            "設定値が長すぎます（最大{}文字）",
            MAX_VALUE_LENGTH
        )));
    }

    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(&key)
    .bind(&value)
    .execute(&*db)
    .await
    .map_err(crate::error::AppError::from)?;

    Ok(())
}
