/// AniList ウォッチリスト同期サービス (v1.1)
///
/// ユーザーの AniList ウォッチリスト (CURRENT / PLANNING) を取得し、
/// `anilist_watchlist` テーブルに UPSERT する。
/// `personal_scoring::batch_external_bonuses()` がこのテーブルを参照して
/// スコアボーナスを計算する。
use crate::error::AppError;
use crate::infra::anilist_client::AniListClient;
use sqlx::SqlitePool;
use std::sync::Arc;
use tracing::{info, warn};

#[derive(Debug, serde::Serialize)]
pub struct AniListSyncResult {
    pub synced_count: usize,
    pub last_synced_at: String,
}

/// AniList ウォッチリストを同期する。
/// username が空の場合はスキップ（Ok を返す）。
pub async fn sync_anilist_watchlist(
    db: &SqlitePool,
    http_client: Arc<reqwest::Client>,
    username: &str,
) -> Result<AniListSyncResult, AppError> {
    if username.is_empty() {
        return Ok(AniListSyncResult {
            synced_count: 0,
            last_synced_at: chrono::Utc::now().to_rfc3339(),
        });
    }

    let client = AniListClient::new(http_client);
    let entries = client.fetch_user_watchlist(username).await.map_err(|e| {
        warn!(error = %e, username, "AniList watchlist fetch failed");
        e
    })?;

    let synced_count = entries.len();
    info!(count = synced_count, username, "AniList watchlist fetched");

    // 既存レコードをクリアして全件 UPSERT（watchlist は全量同期）
    sqlx::query("DELETE FROM anilist_watchlist")
        .execute(db)
        .await?;

    for entry in &entries {
        sqlx::query(
            "INSERT INTO anilist_watchlist
                (media_id, title_romaji, title_native, status, media_type, cover_image_url, fetched_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
             ON CONFLICT(media_id) DO UPDATE SET
               title_romaji = ?2, title_native = ?3, status = ?4,
               media_type = ?5, cover_image_url = ?6, fetched_at = datetime('now')",
        )
        .bind(entry.media_id)
        .bind(&entry.title_romaji)
        .bind(&entry.title_native)
        .bind(&entry.status)
        .bind(&entry.media_type)
        .bind(&entry.cover_image_url)
        .execute(db)
        .await?;
    }

    let now = chrono::Utc::now().to_rfc3339();

    // 最終同期時刻を settings に保存
    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES ('anilist_last_synced_at', ?1, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = datetime('now')",
    )
    .bind(&now)
    .execute(db)
    .await?;

    Ok(AniListSyncResult {
        synced_count,
        last_synced_at: now,
    })
}

/// settings から AniList ユーザー名を取得する。
pub async fn get_anilist_username(db: &SqlitePool) -> Result<String, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'anilist_username'")
            .fetch_optional(db)
            .await?;

    Ok(row.map(|(v,)| v).unwrap_or_default())
}

/// 最終同期日時を取得する。未同期の場合は None。
pub async fn get_anilist_last_synced_at(db: &SqlitePool) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'anilist_last_synced_at'")
            .fetch_optional(db)
            .await?;

    Ok(row.map(|(v,)| v))
}
