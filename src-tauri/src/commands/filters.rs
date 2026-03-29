use crate::error::CmdResult;
use crate::services::filter_queries::{self, KeywordFilter};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn get_keyword_filters(db: State<'_, SqlitePool>) -> CmdResult<Vec<KeywordFilter>> {
    filter_queries::list_filters(&db).await
}

#[tauri::command]
pub async fn add_keyword_filter(
    db: State<'_, SqlitePool>,
    keyword: String,
    filter_type: String,
    category: Option<String>,
) -> CmdResult<KeywordFilter> {
    filter_queries::insert_filter(&db, keyword, filter_type, category).await
}

#[tauri::command]
pub async fn remove_keyword_filter(db: State<'_, SqlitePool>, id: i64) -> CmdResult<()> {
    filter_queries::delete_filter(&db, id).await
}
