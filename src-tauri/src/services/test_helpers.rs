#![cfg(test)]
use sqlx::SqlitePool;

pub async fn setup_test_db() -> SqlitePool {
    let pool = SqlitePool::connect(":memory:").await.unwrap();

    sqlx::query(
        "CREATE TABLE feeds (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL,
            feed_type TEXT NOT NULL, category TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT 1, fetch_interval_minutes INTEGER NOT NULL DEFAULT 60,
            last_fetched_at TEXT, consecutive_errors INTEGER NOT NULL DEFAULT 0,
            last_error TEXT, disabled_reason TEXT, etag TEXT, last_modified TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )",
    )
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "CREATE TABLE articles (
            id INTEGER PRIMARY KEY, feed_id INTEGER NOT NULL, external_id TEXT,
            title TEXT NOT NULL, url TEXT, url_normalized TEXT,
            content TEXT, summary TEXT, author TEXT, published_at TEXT,
            importance_score REAL NOT NULL DEFAULT 0.0,
            is_read BOOLEAN NOT NULL DEFAULT 0, is_bookmarked BOOLEAN NOT NULL DEFAULT 0,
            is_duplicate BOOLEAN NOT NULL DEFAULT 0, duplicate_of INTEGER,
            language TEXT, thumbnail_url TEXT, content_hash TEXT, metadata TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(feed_id, external_id)
        )",
    )
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "CREATE TABLE digests (
            id INTEGER PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL,
            content_markdown TEXT NOT NULL, content_html TEXT,
            article_ids TEXT, model_used TEXT, token_count INTEGER,
            generated_at TEXT NOT NULL
        )",
    )
    .execute(&pool)
    .await
    .unwrap();

    pool
}
