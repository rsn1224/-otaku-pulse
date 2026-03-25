use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
pub struct Studio {
    pub name: String,
}

#[derive(Deserialize, Debug)]
pub struct NextAiringEpisode {
    pub airing_at: i64,
    pub time_until_airing: i64,
    pub episode: i64,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct MediaTitle {
    pub romaji: Option<String>,
    pub english: Option<String>,
    pub native: Option<String>,
    pub user_preferred: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct MediaCoverImage {
    #[serde(rename = "large")]
    pub large: Option<String>,
    #[serde(rename = "medium")]
    pub medium: Option<String>,
    #[serde(rename = "color")]
    pub color: Option<String>,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct ExternalLink {
    pub site: String,
    pub url: String,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct FuzzyDate {
    pub year: Option<i32>,
    pub month: Option<i32>,
    pub day: Option<i32>,
}

#[derive(Deserialize, Debug)]
pub struct StudioNodes {
    pub nodes: Vec<Studio>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct MediaWithSchedule {
    pub id: i32,
    pub title: MediaTitle,
    pub media_type: String,
    pub format: Option<String>,
    pub status: Option<String>,
    pub description: Option<String>,
    pub start_date: Option<FuzzyDate>,
    pub end_date: Option<FuzzyDate>,
    pub episodes: Option<i32>,
    pub chapters: Option<i32>,
    pub cover_image: Option<MediaCoverImage>,
    pub banner_image: Option<String>,
    pub genres: Vec<String>,
    pub synonyms: Vec<String>,
    pub average_score: Option<i32>,
    pub popularity: Option<i32>,
    pub trending: Option<i32>,
    pub external_links: Vec<ExternalLink>,
    pub season: Option<String>,
    pub season_year: Option<i32>,
    pub studios: Option<StudioNodes>,
    pub next_airing_episode: Option<NextAiringEpisode>,
}

#[derive(Deserialize, Debug)]
pub struct AniListScheduleResponse {
    pub data: AniListScheduleData,
}

#[derive(Deserialize, Debug)]
pub struct AniListScheduleData {
    pub page: AniListSchedulePage,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct AniListSchedulePage {
    #[serde(rename = "pageInfo")]
    pub page_info: AniListSchedulePageInfo,
    pub media: Vec<MediaWithSchedule>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct AniListSchedulePageInfo {
    #[serde(rename = "hasNextPage")]
    pub has_next_page: bool,
}

/// Parse anime schedule from AniList response
pub fn parse_anime_schedule(response: &str) -> Result<Vec<MediaWithSchedule>, String> {
    let anilist_response: AniListScheduleResponse = serde_json::from_str(response)
        .map_err(|e| format!("Failed to parse AniList response: {}", e))?;

    Ok(anilist_response.data.page.media)
}
