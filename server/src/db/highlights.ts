import type { DatabaseSync } from 'node:sqlite';
import { type DiscoverRow, type HighlightEntry, toDiscoverArticleDto } from '../types/dto.ts';
import { all, run } from './query.ts';

// highlights_service.rs の read/generate 移植。LLM なし版（reason は固定 '注目'）。
// LLM による理由生成は A2 後続で llm を渡す形に拡張する。

const COLS = `a.id, a.feed_id, a.title, a.url, a.summary, a.author, a.published_at,
  a.is_read, a.is_bookmarked, a.language, a.thumbnail_url, a.ai_summary,
  f.name AS feed_name, f.category AS category, a.impact_level`;

const CACHE_TTL = '-60 minutes';

interface CachedRow extends DiscoverRow {
  reason: string;
}

function readCached(db: DatabaseSync): HighlightEntry[] {
  const r = all<CachedRow>(
    db,
    `SELECT ${COLS}, COALESCE(s.total_score, a.importance_score) AS total_score, dh.reason AS reason
     FROM daily_highlights dh
     JOIN articles a ON a.id = dh.article_id
     JOIN feeds f ON a.feed_id = f.id
     LEFT JOIN article_scores s ON a.id = s.article_id
     WHERE dh.generated_at >= datetime('now', ?) ORDER BY dh.rank ASC`,
    CACHE_TTL,
  );
  return r.map((row) => ({ article: toDiscoverArticleDto(row), reason: row.reason }));
}

function generate(db: DatabaseSync): HighlightEntry[] {
  const articles = all<DiscoverRow>(
    db,
    `SELECT ${COLS}, COALESCE(s.total_score, a.importance_score) AS total_score
     FROM articles a JOIN feeds f ON a.feed_id = f.id
     LEFT JOIN article_scores s ON a.id = s.article_id
     WHERE a.is_duplicate = 0 AND a.published_at >= datetime('now', '-24 hours')
     ORDER BY COALESCE(s.total_score, a.importance_score) DESC LIMIT 5`,
  );

  run(db, 'DELETE FROM daily_highlights');
  if (articles.length === 0) return [];

  articles.forEach((a, i) => {
    run(
      db,
      "INSERT INTO daily_highlights (article_id, reason, rank, generated_at) VALUES (?, ?, ?, datetime('now'))",
      a.id,
      '注目',
      i + 1,
    );
  });

  return articles.map((a) => ({ article: toDiscoverArticleDto(a), reason: '注目' }));
}

export function getDailyHighlights(db: DatabaseSync): HighlightEntry[] {
  const cached = readCached(db);
  if (cached.length > 0) return cached;
  return generate(db);
}
