/// Steam 所有ゲーム同期サービス (v1.1)
///
/// Steam Web API の GetOwnedGames でゲーム一覧を取得し、
/// `steam_games` テーブルに UPSERT する。
/// `personal_scoring::batch_external_bonuses()` がこのテーブルを参照して
/// スコアボーナスを計算する。
use crate::error::AppError;
use crate::infra::steam_client::SteamClient;
use sqlx::SqlitePool;
use std::sync::Arc;
use tracing::{info, warn};

#[derive(Debug, serde::Serialize)]
pub struct SteamSyncResult {
    pub synced_count: usize,
    pub last_synced_at: String,
}

/// Steam 所有ゲームを同期する。
/// api_key または steam_id が空の場合はスキップ（Ok を返す）。
pub async fn sync_steam_games(
    db: &SqlitePool,
    http_client: Arc<reqwest::Client>,
    api_key: &str,
    steam_id: &str,
) -> Result<SteamSyncResult, AppError> {
    if api_key.is_empty() || steam_id.is_empty() {
        return Ok(SteamSyncResult {
            synced_count: 0,
            last_synced_at: chrono::Utc::now().to_rfc3339(),
        });
    }

    let client = SteamClient::new(http_client);
    let games = client
        .fetch_owned_games(api_key, steam_id)
        .await
        .map_err(|e| {
            warn!(error = %e, "Steam owned games fetch failed");
            e
        })?;

    let synced_count = games.len();
    info!(count = synced_count, "Steam owned games fetched");

    for game in &games {
        sqlx::query(
            "INSERT INTO steam_games
                (appid, name, playtime_forever, playtime_2weeks, img_icon_url, fetched_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
             ON CONFLICT(appid) DO UPDATE SET
               name = ?2, playtime_forever = ?3, playtime_2weeks = ?4,
               img_icon_url = ?5, fetched_at = datetime('now')",
        )
        .bind(game.appid)
        .bind(&game.name)
        .bind(game.playtime_forever)
        .bind(game.playtime_2weeks)
        .bind(&game.img_icon_url)
        .execute(db)
        .await?;
    }

    let now = chrono::Utc::now().to_rfc3339();

    // 最終同期時刻を settings に保存
    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES ('steam_last_synced_at', ?1, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = datetime('now')",
    )
    .bind(&now)
    .execute(db)
    .await?;

    Ok(SteamSyncResult {
        synced_count,
        last_synced_at: now,
    })
}

/// settings から Steam API Key と Steam ID を取得する。
pub async fn get_steam_credentials(db: &SqlitePool) -> Result<(String, String), AppError> {
    let api_key: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'steam_api_key'")
            .fetch_optional(db)
            .await?;
    let steam_id: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'steam_id'")
            .fetch_optional(db)
            .await?;

    Ok((
        api_key.map(|(v,)| v).unwrap_or_default(),
        steam_id.map(|(v,)| v).unwrap_or_default(),
    ))
}

/// 最終同期日時を取得する。未同期の場合は None。
pub async fn get_steam_last_synced_at(db: &SqlitePool) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'steam_last_synced_at'")
            .fetch_optional(db)
            .await?;

    Ok(row.map(|(v,)| v))
}
