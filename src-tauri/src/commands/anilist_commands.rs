use crate::services::anilist_watch_service;
use crate::services::steam_sync_service;
use crate::state::AppState;
use tauri::State;

/// AniList ウォッチリストを手動で同期する
#[tauri::command]
pub async fn sync_anilist_now(state: State<'_, AppState>) -> Result<String, String> {
    let username = anilist_watch_service::get_anilist_username(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let result = anilist_watch_service::sync_anilist_watchlist(
        &state.db,
        state.http.clone(),
        &username,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(format!(
        "{}件同期 ({})",
        result.synced_count, result.last_synced_at
    ))
}

/// AniList 最終同期日時を取得する
#[tauri::command]
pub async fn get_anilist_sync_status(
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    anilist_watch_service::get_anilist_last_synced_at(&state.db)
        .await
        .map_err(|e| e.to_string())
}

/// Steam 所有ゲームを手動で同期する
#[tauri::command]
pub async fn sync_steam_now(state: State<'_, AppState>) -> Result<String, String> {
    let (api_key, steam_id) = steam_sync_service::get_steam_credentials(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let result = steam_sync_service::sync_steam_games(
        &state.db,
        state.http.clone(),
        &api_key,
        &steam_id,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(format!(
        "{}件同期 ({})",
        result.synced_count, result.last_synced_at
    ))
}

/// Steam 最終同期日時を取得する
#[tauri::command]
pub async fn get_steam_sync_status(state: State<'_, AppState>) -> Result<Option<String>, String> {
    steam_sync_service::get_steam_last_synced_at(&state.db)
        .await
        .map_err(|e| e.to_string())
}
