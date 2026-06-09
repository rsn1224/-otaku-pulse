import type { DatabaseSync } from 'node:sqlite';
import type { FeedRow } from '../types/models.ts';
import { all, get, run } from './query.ts';

// feed_queries.rs の収集関連クエリ移植。

const MAX_CONSECUTIVE_ERRORS = 3;

const FEED_COLS = `id, name, url, feed_type, category, enabled, fetch_interval_minutes,
  last_fetched_at, consecutive_errors, disabled_reason, last_error,
  etag, last_modified, config, created_at, updated_at`;

export function getEnabledFeeds(db: DatabaseSync): FeedRow[] {
  return all<FeedRow>(db, `SELECT ${FEED_COLS} FROM feeds WHERE enabled = 1`);
}

/** 収集が期限到来した有効フィードのみ（未収集 or interval 超過）。scheduler の tick 用。 */
export function getDueFeeds(db: DatabaseSync): FeedRow[] {
  return all<FeedRow>(
    db,
    `SELECT ${FEED_COLS} FROM feeds
     WHERE enabled = 1
       AND (last_fetched_at IS NULL
            OR last_fetched_at <= datetime('now', '-' || fetch_interval_minutes || ' minutes'))`,
  );
}

export function updateFeedSuccess(
  db: DatabaseSync,
  feedId: number,
  etag: string | null,
  lastModified: string | null,
): void {
  run(
    db,
    `UPDATE feeds SET
       consecutive_errors = 0, last_error = NULL,
       last_fetched_at = datetime('now'),
       etag = ?, last_modified = ?
     WHERE id = ?`,
    etag,
    lastModified,
    feedId,
  );
}

interface ConsecutiveRow {
  consecutive_errors: number;
}

/** 失敗を記録。3 連続で自動無効化。戻り値は更新後の連続エラー数。 */
export function updateFeedFailure(db: DatabaseSync, feedId: number, errorMsg: string): number {
  run(
    db,
    `UPDATE feeds SET consecutive_errors = consecutive_errors + 1, last_error = ? WHERE id = ?`,
    errorMsg,
    feedId,
  );
  const row = get<ConsecutiveRow>(db, 'SELECT consecutive_errors FROM feeds WHERE id = ?', feedId);
  const errors = row?.consecutive_errors ?? 0;
  if (errors >= MAX_CONSECUTIVE_ERRORS) {
    run(
      db,
      `UPDATE feeds SET enabled = 0, disabled_reason = '3回連続エラーにより自動無効化' WHERE id = ?`,
      feedId,
    );
  }
  return errors;
}
