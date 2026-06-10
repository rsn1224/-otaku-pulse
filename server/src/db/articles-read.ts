import type { DatabaseSync } from 'node:sqlite';
import { AppError } from '../error.ts';
import type { ArticleDetailDto } from '../types/dto.ts';
import { get, run } from './query.ts';

interface DetailRow {
  id: number;
  title: string;
  url: string | null;
  content: string | null;
  summary: string | null;
  author: string | null;
  published_at: string | null;
  importance_score: number;
  feed_name: string | null;
}

export function getArticleDetail(db: DatabaseSync, articleId: number): ArticleDetailDto {
  const r = get<DetailRow>(
    db,
    `SELECT a.id, a.title, a.url, a.content, a.summary, a.author, a.published_at,
            a.importance_score, f.name AS feed_name
     FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE a.id = ?`,
    articleId,
  );
  if (r === undefined) throw new AppError('database', '記事が見つかりません');
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    content: r.content,
    summary: r.summary,
    author: r.author,
    publishedAt: r.published_at,
    feedName: r.feed_name,
    importanceScore: r.importance_score,
  };
}

export function markRead(db: DatabaseSync, articleId: number): void {
  run(db, 'UPDATE articles SET is_read = 1 WHERE id = ?', articleId);
}

export function toggleBookmark(db: DatabaseSync, articleId: number): void {
  run(db, 'UPDATE articles SET is_bookmarked = NOT is_bookmarked WHERE id = ?', articleId);
}

export function recordInteraction(
  db: DatabaseSync,
  articleId: number,
  action: string,
  dwellSeconds: number,
): void {
  run(
    db,
    'INSERT INTO article_interactions (article_id, action, dwell_seconds) VALUES (?, ?, ?)',
    articleId,
    action,
    dwellSeconds,
  );
}
