import type { DatabaseSync } from 'node:sqlite';
import {
  type DiscoverFeedResult,
  type DiscoverRow,
  toDiscoverArticleDto,
  type UnreadCounts,
} from '../types/dto.ts';
import { all, get, run } from './query.ts';

// discover_queries.rs + library_queries.rs の移植。SQL は anonymous `?` に統一。

const PAGE_SIZE = 30;
const MAX_LIMIT = 200;

const DISCOVER_COLS = `a.id, a.feed_id, a.title, a.url, a.summary, a.author,
  a.published_at, a.is_read, a.is_bookmarked, a.language,
  a.thumbnail_url, a.ai_summary, f.name AS feed_name, f.category AS category, a.impact_level`;

const INTERACTION_WINDOW = "datetime('now', '-30 days')";

function clampLimit(limit: number | undefined): number {
  const l = limit ?? PAGE_SIZE;
  return Math.min(Math.max(l, 1), MAX_LIMIT);
}

/** mute フィルタが 0 件なら空文字（相関サブクエリを発行しない）。 */
function muteClause(db: DatabaseSync): string {
  const n = get<{ c: number }>(
    db,
    "SELECT COUNT(*) c FROM keyword_filters WHERE filter_type = 'mute'",
  );
  if (n === undefined || n.c === 0) return '';
  return ` AND NOT EXISTS (SELECT 1 FROM keyword_filters kf WHERE kf.filter_type = 'mute'
    AND (LOWER(a.title) LIKE '%' || LOWER(kf.keyword) || '%'
      OR LOWER(COALESCE(a.summary, '')) LIKE '%' || LOWER(kf.keyword) || '%'
      OR LOWER(COALESCE(a.ai_summary, '')) LIKE '%' || LOWER(kf.keyword) || '%'))`;
}

function countAll(db: DatabaseSync): number {
  return get<{ c: number }>(db, 'SELECT COUNT(*) c FROM articles WHERE is_duplicate = 0')?.c ?? 0;
}

function rows(db: DatabaseSync, sql: string, ...params: (string | number)[]): DiscoverRow[] {
  return all<DiscoverRow>(db, sql, ...params);
}

function forYou(db: DatabaseSync, limit: number, offset: number): [DiscoverRow[], number] {
  const mute = muteClause(db);
  const sql = `SELECT ${DISCOVER_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
    FROM articles a JOIN feeds f ON a.feed_id = f.id
    LEFT JOIN article_scores s ON a.id = s.article_id
    WHERE a.is_duplicate = 0${mute}
    ORDER BY total_score DESC, a.published_at DESC LIMIT ? OFFSET ?`;
  return [rows(db, sql, limit, offset), countAll(db)];
}

function trending(db: DatabaseSync, limit: number, offset: number): [DiscoverRow[], number] {
  const mute = muteClause(db);
  // ADR-6: 暗黙FB は統一スコア (article_scores.total_score) に集約済みのため live 加算しない
  // (二重計上回避)。trending は「直近 12h × 統一スコア」を identity とする。
  const sql = `SELECT ${DISCOVER_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
    FROM articles a JOIN feeds f ON a.feed_id = f.id
    LEFT JOIN article_scores s ON a.id = s.article_id
    WHERE a.is_duplicate = 0 AND a.published_at >= datetime('now', '-12 hours')${mute}
    ORDER BY total_score DESC, a.published_at DESC LIMIT ? OFFSET ?`;
  const total =
    get<{ c: number }>(
      db,
      "SELECT COUNT(*) c FROM articles WHERE is_duplicate = 0 AND published_at >= datetime('now', '-12 hours')",
    )?.c ?? 0;
  return [rows(db, sql, limit, offset), total];
}

function byCategory(
  db: DatabaseSync,
  category: string,
  limit: number,
  offset: number,
): [DiscoverRow[], number] {
  const mute = muteClause(db);
  const sql = `SELECT ${DISCOVER_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
    FROM articles a JOIN feeds f ON a.feed_id = f.id
    LEFT JOIN article_scores s ON a.id = s.article_id
    WHERE a.is_duplicate = 0 AND f.category = ?${mute}
    ORDER BY total_score DESC, a.published_at DESC LIMIT ? OFFSET ?`;
  const total =
    get<{ c: number }>(
      db,
      'SELECT COUNT(*) c FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE a.is_duplicate = 0 AND f.category = ?',
      category,
    )?.c ?? 0;
  return [rows(db, sql, category, limit, offset), total];
}

function popular(db: DatabaseSync, limit: number, offset: number): [DiscoverRow[], number] {
  const mute = muteClause(db);
  // ADR-6: engagement を total_score に「加算」せず「ソートキー」にする (二重計上回避)。
  // popular = 「最も engage された記事」、tie-break は統一スコア。engagement が無い間は
  // total_score 順に degrade するため空にならない。表示用 total_score は統一スコアのまま。
  const sql = `SELECT ${DISCOVER_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
    FROM articles a JOIN feeds f ON a.feed_id = f.id
    LEFT JOIN article_scores s ON a.id = s.article_id
    LEFT JOIN (SELECT article_id, SUM(CASE WHEN action='bookmark' THEN 3.0
        WHEN action='deepdive' THEN 2.5 WHEN action='open' THEN 1.0 ELSE 0 END) AS eng
        FROM article_interactions WHERE created_at >= ${INTERACTION_WINDOW}
        GROUP BY article_id) ai ON ai.article_id = a.id
    WHERE a.is_duplicate = 0${mute}
    ORDER BY COALESCE(ai.eng, 0) DESC, total_score DESC, a.published_at DESC LIMIT ? OFFSET ?`;
  return [rows(db, sql, limit, offset), countAll(db)];
}

function mostViewed(db: DatabaseSync, limit: number, offset: number): [DiscoverRow[], number] {
  const mute = muteClause(db);
  const sql = `SELECT ${DISCOVER_COLS}, CAST(COALESCE(ai.vc, 0) AS REAL) AS total_score
    FROM articles a JOIN feeds f ON a.feed_id = f.id
    LEFT JOIN (SELECT article_id, COUNT(*) AS vc FROM article_interactions
        WHERE action = 'open' AND created_at >= ${INTERACTION_WINDOW}
        GROUP BY article_id) ai ON ai.article_id = a.id
    WHERE a.is_duplicate = 0${mute}
    ORDER BY COALESCE(ai.vc, 0) DESC, a.published_at DESC LIMIT ? OFFSET ?`;
  return [rows(db, sql, limit, offset), countAll(db)];
}

// ADR-10: Saved（旧 Saved wing）は Pulse のタブとして提供。ブックマーク記事を published 降順で返す。
function saved(db: DatabaseSync, limit: number, offset: number): [DiscoverRow[], number] {
  const sql = `SELECT ${DISCOVER_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
    FROM articles a JOIN feeds f ON a.feed_id = f.id
    LEFT JOIN article_scores s ON a.id = s.article_id
    WHERE a.is_bookmarked = 1
    ORDER BY a.published_at DESC LIMIT ? OFFSET ?`;
  const total =
    get<{ c: number }>(db, 'SELECT COUNT(*) c FROM articles WHERE is_bookmarked = 1')?.c ?? 0;
  return [rows(db, sql, limit, offset), total];
}

export function getDiscoverFeed(
  db: DatabaseSync,
  tab: string,
  limit?: number,
  offset?: number,
): DiscoverFeedResult {
  const lim = clampLimit(limit);
  const off = Math.max(offset ?? 0, 0);

  let result: [DiscoverRow[], number];
  switch (tab) {
    case 'trending':
      result = trending(db, lim, off);
      break;
    case 'popular':
      result = popular(db, lim, off);
      break;
    case 'most_viewed':
      result = mostViewed(db, lim, off);
      break;
    case 'saved':
      result = saved(db, lim, off);
      break;
    case 'anime':
    case 'manga':
    case 'game':
    case 'pc':
    case 'hardware':
    case 'tech':
      result = byCategory(db, tab === 'hardware' ? 'pc' : tab, lim, off);
      break;
    default:
      result = forYou(db, lim, off);
  }

  const [rowList, total] = result;
  return {
    articles: rowList.map(toDiscoverArticleDto),
    total,
    hasMore: off + lim < total,
  };
}

export function getLibraryArticles(db: DatabaseSync, limit = 30, offset = 0): DiscoverFeedResult {
  const sql = `SELECT ${DISCOVER_COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
    FROM articles a JOIN feeds f ON a.feed_id = f.id
    LEFT JOIN article_scores s ON a.id = s.article_id
    WHERE a.is_bookmarked = 1
    ORDER BY a.published_at DESC LIMIT ? OFFSET ?`;
  const articles = rows(db, sql, limit, offset).map(toDiscoverArticleDto);
  const total =
    get<{ c: number }>(db, 'SELECT COUNT(*) c FROM articles WHERE is_bookmarked = 1')?.c ?? 0;
  return { articles, total, hasMore: offset + limit < total };
}

export function getRelatedArticles(
  db: DatabaseSync,
  articleId: number,
): DiscoverFeedResult['articles'] {
  const sql = `SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author,
      a.published_at, a.is_read, a.is_bookmarked, a.language,
      a.thumbnail_url, a.ai_summary, a.impact_level,
      f.name AS feed_name, f.category AS category, a.importance_score AS total_score
    FROM articles a JOIN feeds f ON a.feed_id = f.id
    WHERE a.is_duplicate = 0 AND a.id != ?
      AND f.category = (SELECT f2.category FROM articles a2 JOIN feeds f2 ON a2.feed_id = f2.id WHERE a2.id = ?)
    ORDER BY a.published_at DESC LIMIT 3`;
  return rows(db, sql, articleId, articleId).map(toDiscoverArticleDto);
}

export function getUnreadCounts(db: DatabaseSync): UnreadCounts {
  const r = get<{
    total: number;
    trending: number;
    anime: number;
    game: number;
    manga: number;
    pc: number;
    tech: number;
  }>(
    db,
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN a.published_at >= datetime('now', '-12 hours') THEN 1 ELSE 0 END) AS trending,
       SUM(CASE WHEN f.category = 'anime' THEN 1 ELSE 0 END) AS anime,
       SUM(CASE WHEN f.category = 'game' THEN 1 ELSE 0 END) AS game,
       SUM(CASE WHEN f.category = 'manga' THEN 1 ELSE 0 END) AS manga,
       SUM(CASE WHEN f.category = 'pc' THEN 1 ELSE 0 END) AS pc,
       SUM(CASE WHEN f.category = 'tech' THEN 1 ELSE 0 END) AS tech
     FROM articles a JOIN feeds f ON a.feed_id = f.id
     WHERE a.is_duplicate = 0 AND a.is_read = 0`,
  );
  return {
    forYou: r?.total ?? 0,
    trending: r?.trending ?? 0,
    anime: r?.anime ?? 0,
    game: r?.game ?? 0,
    manga: r?.manga ?? 0,
    hardware: r?.pc ?? 0,
    tech: r?.tech ?? 0,
  };
}

export function markAllReadCategory(db: DatabaseSync, category: string): number {
  let res: { changes: number | bigint };
  if (category === 'for_you' || category === 'all') {
    res = run(db, 'UPDATE articles SET is_read = 1 WHERE is_read = 0');
  } else if (category === 'trending') {
    res = run(
      db,
      "UPDATE articles SET is_read = 1 WHERE is_read = 0 AND published_at >= datetime('now', '-12 hours')",
    );
  } else {
    const cat = category === 'hardware' ? 'pc' : category;
    res = run(
      db,
      'UPDATE articles SET is_read = 1 WHERE is_read = 0 AND feed_id IN (SELECT id FROM feeds WHERE category = ?)',
      cat,
    );
  }
  return Number(res.changes);
}
