use crate::error::CmdResult;
use crate::models::DiscoverFeedResult;
use crate::services::{discover_queries, personal_scoring, profile_service};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Discover Feed
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_discover_feed(
    state: tauri::State<'_, AppState>,
    tab: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> CmdResult<DiscoverFeedResult> {
    discover_queries::get_discover_feed(&state.db, &tab, limit, offset).await
}

#[tauri::command]
pub async fn get_library_articles(
    state: tauri::State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> CmdResult<DiscoverFeedResult> {
    discover_queries::get_library_articles(&state.db, limit.unwrap_or(30), offset.unwrap_or(0))
        .await
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn record_interaction(
    state: tauri::State<'_, AppState>,
    article_id: i64,
    action: String,
    dwell_seconds: Option<i64>,
) -> CmdResult<()> {
    discover_queries::record_interaction(
        &state.db,
        article_id,
        &action,
        dwell_seconds.unwrap_or(0),
    )
    .await?;

    if action == "open" {
        profile_service::increment_read_count(&state.db).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn rescore_articles(state: tauri::State<'_, AppState>) -> CmdResult<u64> {
    personal_scoring::rescore_all(&state.db).await
}

// ---------------------------------------------------------------------------
// Unread Counts
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnreadCounts {
    pub for_you: i64,
    pub trending: i64,
    pub anime: i64,
    pub game: i64,
    pub manga: i64,
    pub hardware: i64,
}

#[tauri::command]
pub async fn get_unread_counts(state: tauri::State<'_, AppState>) -> CmdResult<UnreadCounts> {
    let row = discover_queries::get_unread_counts(&state.db).await?;
    Ok(UnreadCounts {
        for_you: row.0,
        trending: row.1,
        anime: row.2,
        game: row.3,
        manga: row.4,
        hardware: row.5,
    })
}

#[tauri::command]
pub async fn mark_all_read_category(
    state: tauri::State<'_, AppState>,
    category: String,
) -> CmdResult<i64> {
    discover_queries::mark_all_read_category(&state.db, &category).await
}

#[tauri::command]
pub async fn get_related_articles(
    state: tauri::State<'_, AppState>,
    article_id: i64,
) -> CmdResult<Vec<crate::models::DiscoverArticleDto>> {
    discover_queries::get_related_articles(&state.db, article_id).await
}
