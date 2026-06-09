import type { DatabaseSync } from 'node:sqlite';
import type { ArticleDto } from '../types/dto.ts';
import { all } from './query.ts';

interface FtsRow {
  id: number;
  feed_id: number;
  title: string;
  url: string | null;
  summary: string | null;
  author: string | null;
  published_at: string | null;
  importance_score: number;
  is_read: number;
  is_bookmarked: number;
  language: string | null;
  thumbnail_url: string | null;
  feed_name: string | null;
}

/** FTS5 全文検索。ユーザー入力はフレーズとして引用し MATCH 構文エラーを避ける。 */
export function searchArticles(
  db: DatabaseSync,
  query: string,
  limit: number,
  offset: number,
): ArticleDto[] {
  const phrase = `"${query.replace(/"/g, '""')}"`;
  return all<FtsRow>(
    db,
    `SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author, a.published_at,
            a.importance_score, a.is_read, a.is_bookmarked, a.language, a.thumbnail_url,
            f.name AS feed_name
     FROM articles_fts
     JOIN articles a ON a.id = articles_fts.rowid
     JOIN feeds f ON a.feed_id = f.id
     WHERE articles_fts MATCH ? AND a.is_duplicate = 0
     ORDER BY rank LIMIT ? OFFSET ?`,
    phrase,
    limit,
    offset,
  ).map((r) => ({
    id: r.id,
    feedId: r.feed_id,
    title: r.title,
    url: r.url,
    summary: r.summary,
    author: r.author,
    publishedAt: r.published_at,
    importanceScore: r.importance_score,
    isRead: r.is_read !== 0,
    isBookmarked: r.is_bookmarked !== 0,
    language: r.language,
    thumbnailUrl: r.thumbnail_url,
    feedName: r.feed_name,
  }));
}
