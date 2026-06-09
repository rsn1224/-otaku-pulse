import type { DatabaseSync } from 'node:sqlite';
import { invalidInput } from '../error.ts';
import type { ApiConfig, ScrapeConfig } from '../parsers/scraper.ts';
import type { FeedRow } from '../types/models.ts';
import { all, get, run } from './query.ts';

// feed_queries.rs の add/import/export 系移植 + FeedType.validate_config 相当。

const FEED_TYPES = ['rss', 'reddit', 'anilist', 'steam', 'scraper', 'custom-api'];

const FEED_COLS = `id, name, url, feed_type, category, enabled, fetch_interval_minutes,
  last_fetched_at, consecutive_errors, disabled_reason, last_error,
  etag, last_modified, config, created_at, updated_at`;

function validateConfig(feedType: string, config: string | null): void {
  if (feedType !== 'scraper' && feedType !== 'custom-api') return;

  const raw = config?.trim();
  if (raw === undefined || raw === '') {
    throw invalidInput(`${feedType} ソースには config が必要です`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw invalidInput(`${feedType} config が不正: ${(e as Error).message}`);
  }
  if (feedType === 'scraper') {
    const c = parsed as Partial<ScrapeConfig>;
    if (typeof c.item !== 'string' || typeof c.title !== 'string') {
      throw invalidInput('scraper config: item, title は必須です');
    }
  } else {
    const c = parsed as Partial<ApiConfig>;
    if (typeof c.title !== 'string') {
      throw invalidInput('custom-api config: title は必須です');
    }
  }
}

export interface AddCustomFeedParams {
  name: string;
  url: string;
  feedType: string;
  category: string;
  config?: string | null;
  fetchIntervalMinutes?: number;
}

export function addCustomFeed(db: DatabaseSync, p: AddCustomFeedParams): number {
  if (!FEED_TYPES.includes(p.feedType)) throw invalidInput(`未対応の feed_type: ${p.feedType}`);
  validateConfig(p.feedType, p.config ?? null);
  const interval = Math.min(Math.max(p.fetchIntervalMinutes ?? 60, 5), 10_080);
  const res = run(
    db,
    'INSERT INTO feeds (name, url, feed_type, category, enabled, fetch_interval_minutes, config) VALUES (?, ?, ?, ?, 1, ?, ?)',
    p.name,
    p.url,
    p.feedType,
    p.category,
    interval,
    p.config ?? null,
  );
  return Number(res.lastInsertRowid);
}

export function importFeedIfNew(
  db: DatabaseSync,
  name: string,
  url: string,
  category: string,
): boolean {
  const existing = get<{ id: number }>(db, 'SELECT id FROM feeds WHERE url = ?', url);
  if (existing !== undefined) return false;
  run(
    db,
    "INSERT INTO feeds (name, url, feed_type, category, enabled, fetch_interval_minutes) VALUES (?, ?, 'rss', ?, 1, 60)",
    name,
    url,
    category,
  );
  return true;
}

export function getAllFeedsForExport(db: DatabaseSync): FeedRow[] {
  return all<FeedRow>(db, `SELECT ${FEED_COLS} FROM feeds ORDER BY category, name`);
}
