use crate::error::AppError;
use serde::Deserialize;
use std::sync::Arc;

const RAWG_API_URL: &str = "https://api.rawg.io/api/games";

#[derive(Debug, Deserialize)]
struct RawgResponse {
    results: Vec<RawgGame>,
}

#[derive(Debug, Deserialize)]
struct RawgGame {
    id: i64,
    name: String,
    released: Option<String>,
    background_image: Option<String>,
    slug: String,
    platforms: Option<Vec<RawgPlatformWrapper>>,
}

#[derive(Debug, Deserialize)]
struct RawgPlatformWrapper {
    platform: RawgPlatform,
}

#[derive(Debug, Deserialize)]
struct RawgPlatform {
    name: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameReleaseEntry {
    pub id: i64,
    pub name: String,
    pub released: String,
    pub platforms: Vec<String>,
    pub background_image: Option<String>,
    pub slug: String,
}

/// RAWG API からゲーム発売日を取得
pub async fn fetch_game_releases(
    client: &Arc<reqwest::Client>,
    api_key: &str,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<GameReleaseEntry>, AppError> {
    let url = format!(
        "{}?key={}&dates={},{}&ordering=released&page_size=40",
        RAWG_API_URL, api_key, start_date, end_date
    );

    let response = client
        .get(&url)
        .header("User-Agent", "OtakuPulse/1.0.0")
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "RAWG API error: {} - {}",
            status, body
        )));
    }

    let data: RawgResponse = response.json().await?;

    let entries = data
        .results
        .into_iter()
        .filter_map(|g| {
            let released = g.released?;
            Some(GameReleaseEntry {
                id: g.id,
                name: g.name,
                released,
                platforms: g
                    .platforms
                    .unwrap_or_default()
                    .into_iter()
                    .map(|p| p.platform.name)
                    .collect(),
                background_image: g.background_image,
                slug: g.slug,
            })
        })
        .collect();

    Ok(entries)
}
