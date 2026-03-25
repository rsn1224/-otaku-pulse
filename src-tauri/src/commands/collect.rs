use tauri::State;
use serde::Serialize;
use sqlx::SqlitePool;
use std::sync::Arc;
use crate::error::{AppError, CmdResult};
use crate::services::collector;
use crate::models::Feed;

#[derive(Serialize)]
pub struct CollectResult {
    pub fetched: usize,
    pub saved: usize,
    pub deduped: usize,
    pub errors: Vec<String>,
}

/// 手動でフィード収集を実行し、取得件数を返す（開発用）
#[tauri::command]
pub async fn run_collect_now(
    db: State<'_, SqlitePool>,
    http: State<'_, Arc<reqwest::Client>>,
) -> CmdResult<CollectResult> {
    let mut errors = Vec::new();
    let mut fetched = 0;
    let mut saved = 0;
    let deduped = 0;

    // フィード一覧を取得
    let feeds = match sqlx::query_as::<_, Feed>("SELECT id, name, url, feed_type, category, enabled, fetch_interval_minutes, last_fetched_at, consecutive_errors, disabled_reason, last_error, etag, last_modified, created_at, updated_at FROM feeds WHERE enabled = 1")
        .fetch_all(&*db)
        .await {
            Ok(feeds) => feeds,
            Err(e) => {
                tracing::error!("Failed to fetch feeds: {}", e);
                return Err(crate::error::AppError::Database(e));
            }
        };

    tracing::info!("Starting collection for {} feeds", feeds.len());

    // 各フィードを収集
    for feed in &feeds {
        tracing::info!("Collecting from feed: {} ({})", feed.name, feed.feed_type);

        match collector::collect_feed(&db, &http, feed).await {
            Ok(count) => {
                fetched += count as usize;
                saved += count as usize;
                tracing::info!("Feed {} completed: collected={}", feed.name, count);
            }
            Err(e) => {
                let error_msg = format!("Feed {} failed: {}", feed.name, e);
                errors.push(error_msg.clone());
                tracing::error!("{}", error_msg);
            }
        }
    }

    tracing::info!("Collection completed: fetched={}, saved={}, deduped={}, errors={}", 
        fetched, saved, deduped, errors.len());

    Ok(CollectResult {
        fetched,
        saved,
        deduped,
        errors,
    })
}

/// 初期フィードをデータベースに追加する（開発用）
#[tauri::command]
pub async fn init_default_feeds(
    db: State<'_, SqlitePool>,
) -> CmdResult<u32> {
    let feeds = vec![
        // アニメ・漫画系 RSS
        ("AnimeNewsNetwork JP", "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=jp", "anime", "rss"),
        ("電撃オンライン", "https://dengekionline.com/rss/", "anime", "rss"),
        ("Famitsu", "https://www.famitsu.com/feed/", "game", "rss"),
        ("4Gamer", "https://www.4gamer.net/rss/index.xml", "game", "rss"),
        ("MyAnimeList News", "https://myanimelist.net/rss/news.xml", "anime", "rss"),
    ];

    let mut added = 0;

    for (name, url, category, feed_type) in feeds {
        // 重複チェック
        let existing = sqlx::query("SELECT id FROM feeds WHERE url = ?")
            .bind(url)
            .fetch_optional(&*db)
            .await?;

        if existing.is_none() {
            sqlx::query(
                "INSERT INTO feeds (name, url, feed_type, category, enabled, fetch_interval_minutes)
                 VALUES (?, ?, ?, ?, 1, 60)"
            )
            .bind(name)
            .bind(url)
            .bind(feed_type)
            .bind(category)
            .execute(&*db)
            .await?;

            added += 1;
            tracing::info!("Added default feed: {} ({})", name, url);
        }
    }

    tracing::info!("Initialized {} default feeds", added);
    Ok(added)
}

#[derive(Serialize)]
pub struct DigestResult {
    pub category: String,
    pub summary: String,
    pub article_count: usize,
    pub generated_at: String,
    pub is_ai_generated: bool,
}

#[tauri::command]
pub async fn generate_digest(
    db: State<'_, SqlitePool>,
    category: String,
    hours: Option<i64>,
) -> Result<DigestResult, AppError> {
    let hours = hours.unwrap_or(24);
    
    let articles: Vec<String> = if category == "all" {
        let query = format!(
            "SELECT title FROM articles 
             WHERE datetime(published_at) > datetime('now', '-{} hours')
             ORDER BY published_at DESC LIMIT 20",
            hours
        );
        sqlx::query_scalar(&query).fetch_all(&*db).await?
    } else {
        let query = format!(
            "SELECT a.title FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.category = ? AND datetime(a.published_at) > datetime('now', '-{} hours')
             ORDER BY a.published_at DESC LIMIT 20",
            hours
        );
        sqlx::query_scalar(&query).bind(&category).fetch_all(&*db).await?
    };

    let summary = if articles.is_empty() {
        "最近の記事はありません".to_string()
    } else {
        format!(
            "最近{}時間のハイライト:\n• {}",
            hours,
            articles.join("\n• ")
        )
    };

    let generated_at = chrono::Utc::now().to_rfc3339();

    Ok(DigestResult {
        category,
        summary,
        article_count: articles.len(),
        generated_at,
        is_ai_generated: false,
    })
}
