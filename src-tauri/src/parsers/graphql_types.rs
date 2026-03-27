use serde::Deserialize;
use serde::Serialize;

#[derive(Deserialize, Debug)]
pub struct AniListResponse {
    pub data: AniListData,
}

#[derive(Deserialize, Debug)]
pub struct AniListData {
    pub page: AniListPage,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)] // Fields mapped by serde Deserialize
pub struct AniListPage {
    #[serde(rename = "pageInfo")]
    pub page_info: PageInfo,
    pub media: Vec<Media>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)] // Fields mapped by serde Deserialize
pub struct PageInfo {
    #[serde(rename = "total")]
    pub total: i32,
    #[serde(rename = "perPage")]
    pub per_page: i32,
    #[serde(rename = "currentPage")]
    pub current_page: i32,
    #[serde(rename = "lastPage")]
    pub last_page: i32,
    #[serde(rename = "hasNextPage")]
    pub has_next_page: bool,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)] // Fields mapped by serde Deserialize
pub struct Media {
    pub id: i32,
    pub title: MediaTitle,
    #[serde(rename = "type")]
    pub media_type: String,
    pub format: Option<String>,
    pub status: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "startDate")]
    pub start_date: Option<FuzzyDate>,
    #[serde(rename = "endDate")]
    pub end_date: Option<FuzzyDate>,
    pub episodes: Option<i32>,
    pub chapters: Option<i32>,
    #[serde(rename = "coverImage")]
    pub cover_image: Option<MediaCoverImage>,
    #[serde(rename = "bannerImage")]
    pub banner_image: Option<String>,
    pub genres: Vec<String>,
    pub synonyms: Vec<String>,
    pub average_score: Option<i32>,
    pub popularity: Option<i32>,
    pub trending: Option<i32>,
    #[serde(rename = "externalLinks")]
    pub external_links: Vec<ExternalLink>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)] // Fields mapped by serde Deserialize
pub struct MediaTitle {
    pub romaji: Option<String>,
    pub english: Option<String>,
    pub native: Option<String>,
    pub user_preferred: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)] // Fields mapped by serde Deserialize
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
#[allow(dead_code)] // Fields mapped by serde Deserialize
pub struct FuzzyDate {
    pub year: Option<i32>,
    pub month: Option<i32>,
    pub day: Option<i32>,
}
