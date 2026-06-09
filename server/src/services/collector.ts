import type { DatabaseSync } from 'node:sqlite';
import { collectAniList } from '../collectors/anilist.ts';
import { type CollectOutput, collectRss } from '../collectors/rss.ts';
import { collectCustomApi, collectScraper } from '../collectors/scraper.ts';
import { collectSteam } from '../collectors/steam.ts';
import { type DedupCandidate, recentArticlesForDedup, upsertArticles } from '../db/articles.ts';
import { getDueFeeds, getEnabledFeeds, updateFeedFailure, updateFeedSuccess } from '../db/feeds.ts';
import { generateContentHash, jaccardBigramSimilarity, normalizeUrl } from '../lib/dedup.ts';
import type { CollectedArticle, FeedRow } from '../types/models.ts';
import { calculateImportance } from './scoring.ts';

// collector.rs の移植。node:sqlite は同期のため SQLITE_BUSY 並列リトライは不要。

export interface CollectResult {
  fetched: number;
  saved: number;
  deduped: number;
  errors: string[];
}

const REFRESH_CONCURRENCY = 4;

async function collectByType(feed: FeedRow): Promise<CollectOutput> {
  switch (feed.feed_type) {
    case 'rss':
    case 'reddit':
      return collectRss(feed);
    case 'anilist':
      return { articles: await collectAniList(feed), etag: null, lastModified: null };
    case 'steam':
      return { articles: await collectSteam(feed), etag: null, lastModified: null };
    case 'scraper':
      return { articles: await collectScraper(feed), etag: null, lastModified: null };
    case 'custom-api':
      return { articles: await collectCustomApi(feed), etag: null, lastModified: null };
    default:
      throw new Error(`未対応の feed_type: ${feed.feed_type}`);
  }
}

/**
 * 既存記事と突き合わせ重複マーク（jaccard ≥ 0.6 or content_hash 一致）。
 * Phase B: マーク結果は upsert で is_duplicate/duplicate_of として永続化される。
 */
function markDuplicate(article: CollectedArticle, existing: DedupCandidate[]): void {
  for (const e of existing) {
    // 自分自身（同一 feed + external_id）の既存コピーは比較対象から除外（自己一致防止）。
    if (e.feed_id === article.feedId && e.external_id === article.externalId) continue;
    if (jaccardBigramSimilarity(article.title, e.title) >= 0.6) {
      article.isDuplicate = true;
      article.duplicateOf = e.id;
      return;
    }
    if (
      article.contentHash !== null &&
      e.content_hash !== null &&
      article.contentHash === e.content_hash
    ) {
      article.isDuplicate = true;
      article.duplicateOf = e.id;
      return;
    }
  }
}

export async function collectFeed(db: DatabaseSync, feed: FeedRow): Promise<number> {
  const { articles, etag, lastModified } = await collectByType(feed);

  for (const a of articles) {
    if (a.url !== null) a.urlNormalized = normalizeUrl(a.url);
    if (a.content !== null) a.contentHash = generateContentHash(a.content);
  }

  const existing = recentArticlesForDedup(db, feed.category);
  for (const a of articles) markDuplicate(a, existing);
  for (const a of articles) a.importanceScore = calculateImportance(a, feed.category);

  const count = upsertArticles(db, articles);
  // Phase B: 取得した etag/Last-Modified を永続化し、次回 If-None-Match で条件付き GET。
  updateFeedSuccess(db, feed.id, etag, lastModified);
  return count;
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < items.length) {
      const item = items[i++];
      if (item !== undefined) await fn(item);
    }
  };
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

/** 有効フィードを bounded 並列で収集する。dueOnly=false で全件強制。 */
export async function refreshAll(db: DatabaseSync, dueOnly: boolean): Promise<CollectResult> {
  const feeds = dueOnly ? getDueFeeds(db) : getEnabledFeeds(db);
  let saved = 0;
  const errors: string[] = [];

  await mapLimit(feeds, REFRESH_CONCURRENCY, async (feed) => {
    try {
      // `saved += await ...` は複合代入が await 前に saved を読むため並列下で lost update になる。
      // 必ず await 後に同期加算する。
      const c = await collectFeed(db, feed);
      saved += c;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateFeedFailure(db, feed.id, msg);
      errors.push(`Feed ${feed.name} failed: ${msg}`);
    }
  });

  // Rust の CollectResult は fetched=saved, deduped=0 を返す（忠実移植）。
  return { fetched: saved, saved, deduped: 0, errors };
}
