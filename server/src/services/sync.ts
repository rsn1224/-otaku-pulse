import type { DatabaseSync } from 'node:sqlite';
import { get, run } from '../db/query.ts';
import { fetchUserWatchlist } from '../infra/anilist.ts';
import { fetchOwnedGames } from '../infra/steam.ts';

// anilist_watch_service.rs + steam_sync_service.rs の移植。
// 認証情報（anilist_username / steam_api_key / steam_id）は settings から取得する。

function settingValue(db: DatabaseSync, key: string): string {
  return get<{ value: string }>(db, 'SELECT value FROM settings WHERE key = ?', key)?.value ?? '';
}

function setSyncTimestamp(db: DatabaseSync, key: string, value: string): void {
  run(
    db,
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    key,
    value,
  );
}

export async function syncAniListNow(db: DatabaseSync): Promise<string> {
  const username = settingValue(db, 'anilist_username');
  const now = new Date().toISOString();
  if (username === '') return `0件同期 (${now})`;

  const entries = await fetchUserWatchlist(username);
  run(db, 'DELETE FROM anilist_watchlist');
  for (const e of entries) {
    run(
      db,
      `INSERT INTO anilist_watchlist (media_id, title_romaji, title_native, status, media_type, cover_image_url, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(media_id) DO UPDATE SET
         title_romaji = excluded.title_romaji, title_native = excluded.title_native,
         status = excluded.status, media_type = excluded.media_type,
         cover_image_url = excluded.cover_image_url, fetched_at = datetime('now')`,
      e.mediaId,
      e.titleRomaji,
      e.titleNative,
      e.status,
      e.mediaType,
      e.coverImageUrl,
    );
  }
  setSyncTimestamp(db, 'anilist_last_synced_at', now);
  return `${entries.length}件同期 (${now})`;
}

export function getAniListSyncStatus(db: DatabaseSync): string | null {
  return (
    get<{ value: string }>(db, "SELECT value FROM settings WHERE key = 'anilist_last_synced_at'")
      ?.value ?? null
  );
}

export async function syncSteamNow(db: DatabaseSync): Promise<string> {
  const apiKey = settingValue(db, 'steam_api_key');
  const steamId = settingValue(db, 'steam_id');
  const now = new Date().toISOString();
  if (apiKey === '' || steamId === '') return `0件同期 (${now})`;

  const games = await fetchOwnedGames(apiKey, steamId);
  for (const g of games) {
    run(
      db,
      `INSERT INTO steam_games (appid, name, playtime_forever, playtime_2weeks, img_icon_url, fetched_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(appid) DO UPDATE SET
         name = excluded.name, playtime_forever = excluded.playtime_forever,
         playtime_2weeks = excluded.playtime_2weeks, img_icon_url = excluded.img_icon_url,
         fetched_at = datetime('now')`,
      g.appid,
      g.name,
      g.playtimeForever,
      g.playtime2weeks,
      g.imgIconUrl,
    );
  }
  setSyncTimestamp(db, 'steam_last_synced_at', now);
  return `${games.length}件同期 (${now})`;
}

export function getSteamSyncStatus(db: DatabaseSync): string | null {
  return (
    get<{ value: string }>(db, "SELECT value FROM settings WHERE key = 'steam_last_synced_at'")
      ?.value ?? null
  );
}
