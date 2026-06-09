import type { DatabaseSync } from 'node:sqlite';
import type { DigestDto } from '../types/dto.ts';
import { all, get, run } from './query.ts';

interface DigestRow {
  id: number;
  category: string;
  title: string;
  content_markdown: string;
  content_html: string | null;
  article_ids: string;
  model_used: string | null;
  token_count: number | null;
  generated_at: string;
}

function toDigestDto(r: DigestRow): DigestDto {
  const articleCount = r.article_ids === '' ? 0 : r.article_ids.split(',').length;
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    contentMarkdown: r.content_markdown,
    contentHtml: r.content_html,
    articleCount,
    modelUsed: r.model_used,
    generatedAt: r.generated_at,
  };
}

export function listDigests(db: DatabaseSync, category?: string | null): DigestDto[] {
  const r =
    category !== undefined && category !== null
      ? all<DigestRow>(
          db,
          'SELECT * FROM digests WHERE category = ? ORDER BY generated_at DESC',
          category,
        )
      : all<DigestRow>(db, 'SELECT * FROM digests ORDER BY generated_at DESC');
  return r.map(toDigestDto);
}

export function getLatestDigest(db: DatabaseSync, category: string): DigestDto | null {
  const r = get<DigestRow>(
    db,
    'SELECT * FROM digests WHERE category = ? ORDER BY generated_at DESC LIMIT 1',
    category,
  );
  return r !== undefined ? toDigestDto(r) : null;
}

export function deleteDigest(db: DatabaseSync, digestId: number): void {
  run(db, 'DELETE FROM digests WHERE id = ?', digestId);
}

export interface DigestSourceArticle {
  id: number;
  title: string;
  summary: string | null;
  content: string | null;
}

/** digest 生成元: 同カテゴリ・直近24h・本文ありの記事（最大 limit 件）。 */
export function unsummarizedArticles(
  db: DatabaseSync,
  category: string,
  limit: number,
): DigestSourceArticle[] {
  return all<DigestSourceArticle>(
    db,
    `SELECT a.id, a.title, a.summary, a.content
     FROM articles a JOIN feeds f ON a.feed_id = f.id
     WHERE a.is_duplicate = 0 AND a.content IS NOT NULL
       AND f.category = ? AND a.created_at > datetime('now', '-24 hours')
     ORDER BY a.published_at DESC LIMIT ?`,
    category,
    limit,
  );
}

export interface NewDigest {
  category: string;
  title: string;
  contentMarkdown: string;
  contentHtml: string | null;
  articleIds: string;
  modelUsed: string | null;
  tokenCount: number | null;
  generatedAt: string;
}

export function insertDigest(db: DatabaseSync, d: NewDigest): number {
  const res = run(
    db,
    `INSERT INTO digests (category, title, content_markdown, content_html, article_ids, model_used, token_count, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    d.category,
    d.title,
    d.contentMarkdown,
    d.contentHtml,
    d.articleIds,
    d.modelUsed,
    d.tokenCount,
    d.generatedAt,
  );
  return Number(res.lastInsertRowid);
}
