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
    let filters = sqlx::query(
        "SELECT id, keyword, filter_type, category, created_at 
         FROM keyword_filters 
         ORDER BY created_at DESC",
    )
    .fetch_all(&*db)
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

#[tauri::command]
pub async fn add_keyword_filter(
    db: State<'_, SqlitePool>,
    keyword: String,
    filter_type: String,
    category: Option<String>,
) -> CmdResult<KeywordFilter> {
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
    .execute(&*db)
    .await?;

    let id = result.last_insert_rowid();

    let filter = sqlx::query(
        "SELECT id, keyword, filter_type, category, created_at 
         FROM keyword_filters 
         WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&*db)
    .await?;

    Ok(KeywordFilter {
        id: filter.get("id"),
        keyword: filter.get("keyword"),
        filter_type: filter.get("filter_type"),
        category: filter.get("category"),
        created_at: filter.get("created_at"),
    })
}

#[tauri::command]
pub async fn remove_keyword_filter(db: State<'_, SqlitePool>, id: i64) -> CmdResult<()> {
    sqlx::query("DELETE FROM keyword_filters WHERE id = ?")
        .bind(id)
        .execute(&*db)
        .await?;

    Ok(())
}
