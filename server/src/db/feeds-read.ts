import type { DatabaseSync } from 'node:sqlite';
import { type FeedDto, toFeedDto } from '../types/dto.ts';
import type { FeedRow } from '../types/models.ts';
import { all, get, run } from './query.ts';

const COLS = `id, name, url, feed_type, category, enabled, fetch_interval_minutes,
  last_fetched_at, consecutive_errors, disabled_reason, last_error,
  etag, last_modified, config, created_at, updated_at`;

export function listFeeds(db: DatabaseSync): FeedDto[] {
  return all<FeedRow>(db, `SELECT ${COLS} FROM feeds ORDER BY category, name`).map(toFeedDto);
}

export function getFeedById(db: DatabaseSync, feedId: number): FeedRow | undefined {
  return get<FeedRow>(db, `SELECT ${COLS} FROM feeds WHERE id = ?`, feedId);
}

export function deleteFeed(db: DatabaseSync, feedId: number): void {
  run(db, 'DELETE FROM articles WHERE feed_id = ?', feedId);
  run(db, 'DELETE FROM feeds WHERE id = ?', feedId);
}

export function reenableFeed(db: DatabaseSync, feedId: number): void {
  run(
    db,
    `UPDATE feeds SET enabled = 1, consecutive_errors = 0, disabled_reason = NULL, last_error = NULL
     WHERE id = ?`,
    feedId,
  );
}

export function cleanupOldArticles(db: DatabaseSync, daysOld: number): number {
  const res = run(
    db,
    `DELETE FROM articles WHERE published_at < datetime('now', ?) AND is_bookmarked = 0 AND is_read = 1`,
    `-${daysOld} days`,
  );
  return Number(res.changes);
}
