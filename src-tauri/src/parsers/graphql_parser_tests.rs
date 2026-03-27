use super::*;
use serde_json::json;

#[test]
fn test_anilist_to_articles() {
    let response = json!({
        "data": {
            "page": {
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
                        "english": "Test Anime",
                        "native": "テストアニメ",
                        "userPreferred": "Test Anime"
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
                    "chapters": null,
                    "coverImage": {
                        "large": "https://example.com/image.jpg"
                    },
                    "externalLinks": [],
                    "medium": null,
                    "color": "#ffffff",
                    "bannerImage": null,
                    "genres": ["Action", "Adventure"],
                    "synonyms": ["Test"],
                    "averageScore": 80,
                    "popularity": 1000,
                    "trending": 100
                }]
            },
            "pageInfo": {
                "total": 1,
                "perPage": 1,
                "currentPage": 1,
                "lastPage": 1,
                "hasNextPage": false
            }
        }
    });

    let articles = anilist_to_articles(&response.to_string(), "anime").unwrap();

    assert_eq!(articles.len(), 1);
    let article = &articles[0];
    assert_eq!(&article.title, "Test Anime");
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
