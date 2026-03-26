#![allow(dead_code)]
use crate::error::{AppError, CmdResult};
use crate::models::Feed;
use crate::services::collector;
use serde::Serialize;
use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::State;

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

    tracing::info!(
        "Collection completed: fetched={}, saved={}, deduped={}, errors={}",
        fetched,
        saved,
        deduped,
        errors.len()
    );

    Ok(CollectResult {
        fetched,
        saved,
        deduped,
        errors,
    })
}

/// 初期フィードをデータベースに追加する（開発用）
#[tauri::command]
pub async fn init_default_feeds(db: State<'_, SqlitePool>) -> CmdResult<u32> {
    let feeds = vec![
        // アニメ
        (
            "AnimeNewsNetwork JP",
            "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=jp",
            "anime",
            "rss",
        ),
        (
            "アニメ!アニメ!",
            "https://animeanime.jp/rss/index.rdf",
            "anime",
            "rss",
        ),
        (
            "MyAnimeList News",
            "https://myanimelist.net/rss/news.xml",
            "anime",
            "rss",
        ),
        (
            "Anime Corner",
            "https://animecorner.me/feed",
            "anime",
            "rss",
        ),
        (
            "Crunchyroll News",
            "https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss",
            "anime",
            "rss",
        ),
        // 漫画
        (
            "コミックナタリー",
            "https://natalie.mu/comic/feed/news",
            "manga",
            "rss",
        ),
        (
            "Otaku USA",
            "https://otakuusamagazine.com/anime/feed",
            "manga",
            "rss",
        ),
        // ゲーム
        (
            "4Gamer",
            "https://www.4gamer.net/rss/index.xml",
            "game",
            "rss",
        ),
        ("Gematsu", "https://www.gematsu.com/feed", "game", "rss"),
        ("PC Gamer", "https://www.pcgamer.com/rss/", "game", "rss"),
        // PC ハードウェア
        (
            "PC Watch",
            "https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf",
            "pc",
            "rss",
        ),
        (
            "Tom's Hardware",
            "https://www.tomshardware.com/feeds/all",
            "pc",
            "rss",
        ),
        (
            "ITmedia",
            "https://rss.itmedia.co.jp/rss/2.0/topstory.xml",
            "pc",
            "rss",
        ),
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

    // カテゴリ不整合の自動修正（URL ドメインからカテゴリを推定）
    let corrections: Vec<(&str, &str)> = vec![
        // PC/テック系
        ("gigazine.net", "pc"),
        ("pc.watch.impress.co.jp", "pc"),
        ("tomshardware.com", "pc"),
        ("gamersnexus.net", "pc"),
        ("igorslab.de", "pc"),
        ("pcgamer.com", "game"),
        // アニメ
        ("animenewsnetwork.com", "anime"),
        ("animeanime.jp", "anime"),
        ("myanimelist.net", "anime"),
        // 漫画
        ("natalie.mu/comic", "manga"),
        // ゲーム
        ("4gamer.net", "game"),
        ("gematsu.com", "game"),
        // Reddit — URL で判別
        ("reddit.com/r/anime", "anime"),
        ("reddit.com/r/manga", "manga"),
        ("reddit.com/r/pcgaming", "game"),
        ("reddit.com/r/steam", "game"),
        ("reddit.com/r/hardware", "pc"),
        ("animecorner.me", "anime"),
        ("crunchyrollsvc.com", "anime"),
        ("otakuusamagazine.com", "manga"),
        ("itmedia.co.jp", "pc"),
    ];

    for (domain, correct_category) in &corrections {
        let updated =
            sqlx::query("UPDATE feeds SET category = ?1 WHERE url LIKE ?2 AND category != ?1")
                .bind(correct_category)
                .bind(format!("%{}%", domain))
                .execute(&*db)
                .await?;

        if updated.rows_affected() > 0 {
            tracing::info!(
                "Fixed category for feeds matching '{}' → '{}'  ({} updated)",
                domain,
                correct_category,
                updated.rows_affected()
            );
        }
    }

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
        sqlx::query_scalar(&query)
            .bind(&category)
            .fetch_all(&*db)
            .await?
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
