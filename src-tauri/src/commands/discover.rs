use crate::error::CmdResult;
use crate::models::DiscoverFeedResult;
use crate::services::{discover_queries, personal_scoring, profile_service};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Discover Feed
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_discover_feed(
    state: tauri::State<'_, AppState>,
    tab: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> CmdResult<DiscoverFeedResult> {
    discover_queries::get_discover_feed(&state.db, &tab, limit, offset).await
}

#[tauri::command]
pub async fn get_library_articles(
    state: tauri::State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> CmdResult<DiscoverFeedResult> {
    discover_queries::get_library_articles(&state.db, limit.unwrap_or(30), offset.unwrap_or(0))
        .await
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn record_interaction(
    state: tauri::State<'_, AppState>,
    article_id: i64,
    action: String,
    dwell_seconds: Option<i64>,
) -> CmdResult<()> {
    discover_queries::record_interaction(
        &state.db,
        article_id,
        &action,
        dwell_seconds.unwrap_or(0),
    )
    .await?;

    if action == "open" {
        profile_service::increment_read_count(&state.db).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn rescore_articles(state: tauri::State<'_, AppState>) -> CmdResult<u64> {
    personal_scoring::rescore_all(&state.db).await
}

// ---------------------------------------------------------------------------
// Unread Counts
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnreadCounts {
    pub for_you: i64,
    pub trending: i64,
    pub anime: i64,
    pub game: i64,
    pub manga: i64,
    pub hardware: i64,
}

#[tauri::command]
pub async fn get_unread_counts(state: tauri::State<'_, AppState>) -> CmdResult<UnreadCounts> {
    let row: (i64, i64, i64, i64, i64, i64) = sqlx::query_as(
        "SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN a.published_at >= datetime('now', '-12 hours') THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'anime' THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'game' THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'manga' THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'pc' THEN 1 ELSE 0 END)
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_duplicate = 0 AND a.is_read = 0",
    )
    .fetch_one(&*state.db)
    .await?;

    Ok(UnreadCounts {
        for_you: row.0,
        trending: row.1,
        anime: row.2,
        game: row.3,
        manga: row.4,
        hardware: row.5,
    })
}

#[tauri::command]
pub async fn mark_all_read_category(
    state: tauri::State<'_, AppState>,
    category: String,
) -> CmdResult<i64> {
    let result = if category == "for_you" || category == "all" {
        sqlx::query("UPDATE articles SET is_read = 1 WHERE is_read = 0")
            .execute(&*state.db)
            .await?
    } else if category == "trending" {
        sqlx::query(
            "UPDATE articles SET is_read = 1
             WHERE is_read = 0 AND published_at >= datetime('now', '-12 hours')",
        )
        .execute(&*state.db)
        .await?
    } else {
        let cat = if category == "hardware" {
            "pc"
        } else {
            &category
        };
        sqlx::query(
            "UPDATE articles SET is_read = 1
             WHERE is_read = 0 AND feed_id IN (SELECT id FROM feeds WHERE category = ?1)",
        )
        .bind(cat)
        .execute(&*state.db)
        .await?
    };

    Ok(result.rows_affected() as i64)
}

#[tauri::command]
pub async fn get_related_articles(
    state: tauri::State<'_, AppState>,
    article_id: i64,
) -> CmdResult<Vec<crate::models::DiscoverArticleDto>> {
    let articles = sqlx::query_as::<_, crate::models::DiscoverArticleDto>(
        "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author,
                a.published_at, a.is_read, a.is_bookmarked, a.language,
                a.thumbnail_url, a.ai_summary,
                f.name AS feed_name, f.category AS category,
                a.importance_score AS total_score
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_duplicate = 0 AND a.id != ?1
           AND f.category = (SELECT f2.category FROM articles a2 JOIN feeds f2 ON a2.feed_id = f2.id WHERE a2.id = ?1)
         ORDER BY a.published_at DESC
         LIMIT 3",
    )
    .bind(article_id)
    .fetch_all(&*state.db)
    .await?;

    Ok(articles)
}
