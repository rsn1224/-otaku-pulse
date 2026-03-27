use super::*;
use crate::services::test_helpers::setup_test_db;

async fn seed_feed_and_article(db: &SqlitePool) -> i64 {
    sqlx::query(
        "INSERT INTO feeds (name, url, feed_type, category, created_at, updated_at)
         VALUES ('Test Feed', 'https://example.com/rss', 'rss', 'anime',
                 datetime('now'), datetime('now'))",
    )
    .execute(db)
    .await
    .unwrap();

    let result = sqlx::query(
        "INSERT INTO articles (feed_id, external_id, title, url, importance_score)
         VALUES (1, 'ext-1', 'Test Article', 'https://example.com/1', 0.5)",
    )
    .execute(db)
    .await
    .unwrap();

    result.last_insert_rowid()
}

#[tokio::test]
async fn list_articles_returns_empty_for_empty_db() {
    let db = setup_test_db().await;
    let result = list_articles(&db, None).await.unwrap();
    assert!(result.is_empty());
}

#[tokio::test]
async fn list_articles_returns_articles() {
    let db = setup_test_db().await;
    seed_feed_and_article(&db).await;

    let result = list_articles(&db, None).await.unwrap();
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].title, "Test Article");
}

#[tokio::test]
async fn list_articles_filters_by_category() {
    let db = setup_test_db().await;
    seed_feed_and_article(&db).await;

    let anime = list_articles(&db, Some("anime")).await.unwrap();
    assert_eq!(anime.len(), 1);

    let game = list_articles(&db, Some("game")).await.unwrap();
    assert!(game.is_empty());
}

#[tokio::test]
async fn mark_as_read_updates_flag() {
    let db = setup_test_db().await;
    let id = seed_feed_and_article(&db).await;

    mark_as_read(&db, id).await.unwrap();

    let articles = list_articles(&db, None).await.unwrap();
    assert!(articles[0].is_read);
}

#[tokio::test]
async fn toggle_bookmark_toggles_flag() {
    let db = setup_test_db().await;
    let id = seed_feed_and_article(&db).await;

    toggle_bookmark(&db, id).await.unwrap();
    let articles = list_articles(&db, None).await.unwrap();
    assert!(articles[0].is_bookmarked);

    toggle_bookmark(&db, id).await.unwrap();
    let articles = list_articles(&db, None).await.unwrap();
    assert!(!articles[0].is_bookmarked);
}

#[tokio::test]
async fn mark_all_as_read_by_category() {
    let db = setup_test_db().await;
    seed_feed_and_article(&db).await;

    let count = mark_all_as_read(&db, Some("anime")).await.unwrap();
    assert_eq!(count, 1);

    let articles = list_articles(&db, None).await.unwrap();
    assert!(articles[0].is_read);
}
