use tauri::State;
use sqlx::SqlitePool;
use crate::error::CmdResult;
use crate::infra::anilist_client;
use crate::parsers::schedule_parser;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimeSchedule {
    pub id: i64,
    pub title_romaji: String,
    pub title_english: Option<String>,
    pub title_native: Option<String>,
    pub format: String,
    pub status: String,
    pub episodes: Option<i64>,
    pub duration: Option<i64>,
    pub cover_image_large: Option<String>,
    pub cover_image_medium: Option<String>,
    pub start_date_year: Option<i64>,
    pub start_date_month: Option<i64>,
    pub start_date_day: Option<i64>,
    pub end_date_year: Option<i64>,
    pub end_date_month: Option<i64>,
    pub end_date_day: Option<i64>,
    pub season: String,
    pub season_year: i64,
    pub genres: Vec<String>,
    pub studios: Vec<String>,
    pub next_airing_at: Option<i64>,
    pub time_until_airing: Option<i64>,
    pub next_episode: Option<i64>,
}

#[tauri::command]
pub async fn get_anime_schedule(
    _db: State<'_, SqlitePool>,
    season: String,
    year: i64,
) -> CmdResult<Vec<AnimeSchedule>> {
    // GraphQLクエリを実行
    let query = include_str!("../../graphql/anime_schedule.graphql");
    let variables = serde_json::json!({
        "season": season,
        "year": year
    });
    
    let response = anilist_client::query_anilist(query, &variables).await?;
    let articles = schedule_parser::parse_anime_schedule(&response).map_err(|e| {
        crate::error::AppError::ParseError(e)
    })?;
    
    // DTOに変換
    let schedules: Vec<AnimeSchedule> = articles.into_iter().map(|media| {
        let title = &media.title;
        let cover_image = &media.cover_image;
        let start_date = &media.start_date;
        let end_date = &media.end_date;
        let next_airing = &media.next_airing_episode;
        
        AnimeSchedule {
            id: media.id as i64,
            title_romaji: title.romaji.clone().unwrap_or_default(),
            title_english: title.english.clone(),
            title_native: title.native.clone(),
            format: media.format.clone().unwrap_or_default(),
            status: media.status.clone().unwrap_or_default(),
            episodes: media.episodes.map(|e| e as i64),
            duration: None, // Not available in current schema
            cover_image_large: cover_image.as_ref().and_then(|ci| ci.large.clone()),
            cover_image_medium: cover_image.as_ref().and_then(|ci| ci.medium.clone()),
            start_date_year: start_date.as_ref().and_then(|sd| sd.year).map(|y| y as i64),
            start_date_month: start_date.as_ref().and_then(|sd| sd.month).map(|m| m as i64),
            start_date_day: start_date.as_ref().and_then(|sd| sd.day).map(|d| d as i64),
            end_date_year: end_date.as_ref().and_then(|ed| ed.year).map(|y| y as i64),
            end_date_month: end_date.as_ref().and_then(|ed| ed.month).map(|m| m as i64),
            end_date_day: end_date.as_ref().and_then(|ed| ed.day).map(|d| d as i64),
            season: media.season.clone().unwrap_or_default(),
            season_year: media.season_year.map(|y| y as i64).unwrap_or(year),
            genres: media.genres.clone(),
            studios: media.studios.as_ref()
                .map(|s| s.nodes.iter().map(|n| n.name.clone()).collect())
                .unwrap_or_default(),
            next_airing_at: next_airing.as_ref().map(|na| na.airing_at),
            time_until_airing: next_airing.as_ref().map(|na| na.time_until_airing),
            next_episode: next_airing.as_ref().map(|na| na.episode),
        }
    }).collect();
    
    Ok(schedules)
}
