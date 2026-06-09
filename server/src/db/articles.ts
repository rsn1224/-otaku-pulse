import type { DatabaseSync } from 'node:sqlite';
import { classifyImpact } from '../services/impact.ts';
import type { CollectedArticle } from '../types/models.ts';
import { all, run } from './query.ts';

// article_queries.rs の upsert / dedup 取得移植。

/** dedup 判定用の既存記事候補（直近7日・同カテゴリ）。feed_id/external_id は自己除外用。 */
export interface DedupCandidate {
  id: number;
  feed_id: number;
  external_id: string | null;
  title: string;
  content_hash: string | null;
}

export function recentArticlesForDedup(db: DatabaseSync, category: string): DedupCandidate[] {
  return all<DedupCandidate>(
    db,
    `SELECT a.id, a.feed_id, a.external_id, a.title, a.content_hash
     FROM articles a
     JOIN feeds f ON a.feed_id = f.id
     WHERE f.category = ? AND a.created_at >= datetime('now', '-7 days')
     ORDER BY a.created_at DESC`,
    category,
  );
}

const INSERT_SQL = `INSERT INTO articles (
    feed_id, external_id, title, url, url_normalized, content, summary,
    author, published_at, importance_score, language, thumbnail_url,
    content_hash, metadata, is_duplicate, duplicate_of
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(feed_id, external_id) DO UPDATE SET
    title = excluded.title,
    url = excluded.url,
    url_normalized = excluded.url_normalized,
    content = excluded.content,
    summary = excluded.summary,
    author = excluded.author,
    published_at = excluded.published_at,
    importance_score = excluded.importance_score,
    language = excluded.language,
    thumbnail_url = excluded.thumbnail_url,
    content_hash = excluded.content_hash,
    metadata = excluded.metadata,
    is_duplicate = excluded.is_duplicate,
    duplicate_of = excluded.duplicate_of
  WHERE 1=1`;

/**
 * 記事を upsert し、impact_level を後続 UPDATE で設定する。
 * Phase B (ADR-6): is_duplicate/duplicate_of を永続化（旧 Rust 版の no-op バグを修正）。
 * これにより discover の `WHERE is_duplicate = 0` フィルタが実際に効く。
 */
export function upsertArticles(db: DatabaseSync, articles: CollectedArticle[]): number {
  if (articles.length === 0) return 0;

  let count = 0;
  db.exec('BEGIN');
  try {
    for (const a of articles) {
      const res = run(
        db,
        INSERT_SQL,
        a.feedId,
        a.externalId,
        a.title,
        a.url,
        a.urlNormalized,
        a.content,
        a.summary,
        a.author,
        a.publishedAt,
        a.importanceScore,
        a.language,
        a.thumbnailUrl,
        a.contentHash,
        a.metadata,
        a.isDuplicate ? 1 : 0,
        a.duplicateOf,
      );
      if (Number(res.changes) > 0) {
        count++;
        const level = classifyImpact(a.title, a.summary ?? a.content);
        run(
          db,
          'UPDATE articles SET impact_level = ? WHERE feed_id = ? AND external_id = ?',
          level,
          a.feedId,
          a.externalId,
        );
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return count;
}
