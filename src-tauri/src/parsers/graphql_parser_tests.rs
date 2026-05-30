use super::*;
use serde_json::json;

// Mirrors the real AniList GraphQL response shape: the root field selected in the
// query is `Page` (capital P, no alias), so the response key is `data.Page` — NOT
// `data.page`. The previous sample used lowercase `page`, which masked the
// "missing field `page`" deserialization crash that broke feed collection at runtime.
fn sample_seasonal_anime_response() -> String {
    json!({
        "data": {
            "Page": {
                "pageInfo": {
                    "total": 1,
                    "perPage": 50,
                    "currentPage": 1,
                    "lastPage": 1,
                    "hasNextPage": false
                },
                "media": [{
                    "id": 1,
                    "title": {
                        "romaji": "Test Anime",
                        "english": "Test Anime EN",
                        "native": "テストアニメ",
                        "userPreferred": "Test Anime Preferred"
                    },
                    "type": "ANIME",
                    "format": "TV",
                    "status": "FINISHED",
                    "description": "This is a <b>test</b> anime.",
                    "startDate": {
                        "year": 2023,
                        "month": 1,
                        "day": 1
                    },
                    "endDate": null,
                    "episodes": 12,
                    "coverImage": {
                        "large": "https://example.com/image.jpg",
                        "medium": "https://example.com/image_m.jpg",
                        "color": "#ffffff"
                    },
                    "bannerImage": null,
                    "genres": ["Action", "Adventure"],
                    "synonyms": ["Test"],
                    "averageScore": 80,
                    "popularity": 1000,
                    "trending": 100,
                    "externalLinks": [
                        { "site": "Official Site", "url": "https://example.com" }
                    ]
                }]
            }
        }
    })
    .to_string()
}

#[test]
fn test_anilist_to_articles() {
    let articles = anilist_to_articles(&sample_seasonal_anime_response(), "anime").unwrap();

    assert_eq!(articles.len(), 1);
    let article = &articles[0];
    // userPreferred must win over english/romaji — proves the `userPreferred` rename is wired up
    assert_eq!(&article.title, "Test Anime Preferred");
    assert_eq!(article.content.as_ref().unwrap(), "This is a test anime.");
    assert_eq!(article.external_id.as_ref().unwrap(), "anilist:1");
    assert_eq!(article.url.as_ref().unwrap(), "https://anilist.co/anime/1");
    assert_eq!(article.published_at.as_ref().unwrap(), "2023-01-01");
    assert_eq!(
        article.thumbnail_url.as_ref().unwrap(),
        "https://example.com/image.jpg"
    );
    assert_eq!(article.language.as_ref().unwrap(), "ja");
}

// Regression: AniList nests results under `data.Page` (capital P). A struct expecting
// lowercase `page` fails with "missing field `page`" and collects 0 articles.
#[test]
fn test_anilist_deserializes_capital_page_field() {
    let parsed: AniListResponse =
        serde_json::from_str(&sample_seasonal_anime_response()).expect("must parse data.Page");
    assert_eq!(parsed.data.page.media.len(), 1);
    assert_eq!(parsed.data.page.page_info.per_page, 50);
}

// Regression: lowercase `data.page` is NOT what AniList returns and must be rejected,
// so this exact shape never silently regresses back into the sample fixtures.
#[test]
fn test_anilist_rejects_lowercase_page_field() {
    let lowercase = json!({
        "data": { "page": { "pageInfo": {}, "media": [] } }
    })
    .to_string();
    let result = anilist_to_articles(&lowercase, "anime");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("missing field `Page`"));
}

// averageScore (camelCase) must deserialize into average_score so it contributes to scoring.
#[test]
fn test_anilist_captures_average_score() {
    let articles = anilist_to_articles(&sample_seasonal_anime_response(), "anime").unwrap();
    // With averageScore captured: 0.5 + pop(0.1) + trend(0.1) + avgScore(0.16) + genres(0.1) = 0.96.
    // If the rename is missing, average_score is None → 0.80. Threshold 0.9 distinguishes the two.
    assert!(
        articles[0].importance_score > 0.9,
        "averageScore should lift importance_score above 0.9, got {}",
        articles[0].importance_score
    );
}

// Manga feeds must produce /manga/{id} permalinks, not /anime/{id}. The parser keys
// the URL path off the `category` argument passed by the AniList client.
#[test]
fn test_anilist_manga_url_segment() {
    let response = json!({
        "data": {
            "Page": {
                "pageInfo": {
                    "total": 1,
                    "perPage": 50,
                    "currentPage": 1,
                    "lastPage": 1,
                    "hasNextPage": false
                },
                "media": [{
                    "id": 42,
                    "title": {
                        "romaji": "Test Manga",
                        "english": null,
                        "native": "テスト漫画",
                        "userPreferred": "Test Manga"
                    },
                    "type": "MANGA",
                    "format": "MANGA",
                    "status": "RELEASING",
                    "description": "A test manga.",
                    "startDate": { "year": 2024, "month": 3, "day": 1 },
                    "endDate": null,
                    "chapters": 100,
                    "coverImage": { "large": "https://example.com/m.jpg" },
                    "bannerImage": null,
                    "genres": ["Drama"],
                    "synonyms": [],
                    "averageScore": 75,
                    "popularity": 500,
                    "trending": 50,
                    "externalLinks": []
                }]
            }
        }
    })
    .to_string();

    let articles = anilist_to_articles(&response, "manga").unwrap();
    assert_eq!(articles.len(), 1);
    assert_eq!(
        articles[0].url.as_ref().unwrap(),
        "https://anilist.co/manga/42"
    );
}

#[test]
fn test_convert_html_to_text() {
    assert_eq!(
        convert_html_to_text("<p>Hello <b>World</b></p>"),
        "Hello World"
    );
    assert_eq!(convert_html_to_text("A &amp; B"), "A & B");
    assert_eq!(
        convert_html_to_text("  Multiple   spaces  "),
        "Multiple spaces"
    );
}

#[test]
fn test_calculate_importance_score() {
    let media = Media {
        id: 1,
        title: MediaTitle {
            romaji: Some("Test".to_string()),
            english: None,
            native: None,
            user_preferred: None,
        },
        media_type: "ANIME".to_string(),
        format: Some("TV".to_string()),
        status: Some("FINISHED".to_string()),
        description: None,
        start_date: None,
        end_date: None,
        episodes: Some(12),
        chapters: None,
        cover_image: None,
        banner_image: None,
        genres: vec!["Action".to_string(), "Adventure".to_string()],
        synonyms: vec![],
        average_score: Some(80),
        popularity: Some(1000),
        trending: Some(100),
        external_links: vec![],
    };

    let score = calculate_importance_score(&media);
    assert!(score > 0.5);
    assert!(score <= 1.0);
}
