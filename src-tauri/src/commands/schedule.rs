use crate::error::{AppError, CmdResult};
use crate::infra::{anilist_client, credential_store, rawg_client};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiringEntry {
    pub id: i64,
    pub episode: i64,
    pub airing_at: i64,
    pub media_id: i64,
    pub title_native: Option<String>,
    pub title_romaji: String,
    pub cover_image_url: Option<String>,
    pub total_episodes: Option<i64>,
    pub site_url: Option<String>,
}

#[derive(Deserialize)]
struct AiringResponse {
    data: AiringData,
}

#[derive(Deserialize)]
struct AiringData {
    #[serde(rename = "Page")]
    page: AiringPage,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiringPageInfo {
    has_next_page: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiringPage {
    page_info: AiringPageInfo,
    airing_schedules: Vec<AiringScheduleNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiringScheduleNode {
    id: i64,
    episode: i64,
    airing_at: i64,
    media: AiringMedia,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiringMedia {
    id: i64,
    title: AiringTitle,
    cover_image: Option<AiringCoverImage>,
    episodes: Option<i64>,
    site_url: Option<String>,
}

#[derive(Deserialize)]
struct AiringTitle {
    native: Option<String>,
    romaji: Option<String>,
}

#[derive(Deserialize)]
struct AiringCoverImage {
    medium: Option<String>,
}

fn parse_airing_response(json: &str) -> Result<(Vec<AiringEntry>, bool), String> {
    let resp: AiringResponse =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse airing response: {e}"))?;

    let has_next = resp.data.page.page_info.has_next_page;
    let entries = resp
        .data
        .page
        .airing_schedules
        .into_iter()
        .map(|node| AiringEntry {
            id: node.id,
            episode: node.episode,
            airing_at: node.airing_at,
            media_id: node.media.id,
            title_native: node.media.title.native,
            title_romaji: node.media.title.romaji.unwrap_or_default(),
            cover_image_url: node.media.cover_image.and_then(|ci| ci.medium),
            total_episodes: node.media.episodes,
            site_url: node.media.site_url,
        })
        .collect();

    Ok((entries, has_next))
}

#[tauri::command]
pub async fn get_airing_schedule(
    start_timestamp: Option<i64>,
    days_ahead: Option<i64>,
) -> CmdResult<Vec<AiringEntry>> {
    let start = start_timestamp.unwrap_or_else(|| chrono::Utc::now().timestamp());
    let days = days_ahead.unwrap_or(7);
    let end = start + days * 86400;
    let query = include_str!("../../graphql/airing_schedule.graphql");

    let mut all_entries = Vec::new();
    let mut page = 1_i64;
    let max_pages = 5;

    loop {
        let variables = serde_json::json!({
            "airingAtGreater": start,
            "airingAtLesser": end,
            "page": page
        });
        let response = anilist_client::query_anilist(query, &variables).await?;
        let (entries, has_next) =
            parse_airing_response(&response).map_err(crate::error::AppError::Parse)?;
        all_entries.extend(entries);

        if !has_next || page >= max_pages {
            break;
        }
        page += 1;
    }

    Ok(all_entries)
}

#[tauri::command]
pub async fn get_game_releases(
    http: State<'_, Arc<Client>>,
    start_date: String,
    end_date: String,
) -> CmdResult<Vec<rawg_client::GameReleaseEntry>> {
    let api_key = credential_store::load_credential(credential_store::RAWG_ACCOUNT)?
        .ok_or_else(|| AppError::InvalidInput("RAWG API キーが未設定です".into()))?;
    rawg_client::fetch_game_releases(&http, &api_key, &start_date, &end_date).await
}

#[tauri::command]
pub async fn set_rawg_api_key(api_key: String) -> CmdResult<()> {
    let api_key = api_key.trim().to_string();
    if api_key.is_empty() {
        return Err(AppError::InvalidInput("RAWG API キーが空です".into()));
    }
    credential_store::store_credential(credential_store::RAWG_ACCOUNT, &api_key)?;
    tracing::info!("RAWG API key stored in credential store");
    Ok(())
}

#[tauri::command]
pub async fn clear_rawg_api_key() -> CmdResult<()> {
    credential_store::delete_credential(credential_store::RAWG_ACCOUNT)?;
    tracing::info!("RAWG API key cleared from credential store");
    Ok(())
}

#[tauri::command]
pub async fn is_rawg_api_key_set() -> CmdResult<bool> {
    let key = credential_store::load_credential(credential_store::RAWG_ACCOUNT)?;
    Ok(key.is_some())
}
