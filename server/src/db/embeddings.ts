import type { DatabaseSync } from 'node:sqlite';
import { all, get, run } from './query.ts';

// ADR-7: article_embeddings の read/write。embedding は JSON 配列で保存。

export interface EmbedTarget {
  id: number;
  title: string;
  summary: string | null;
  content: string | null;
}

/** 未 embedding の記事（直近30日・非重複）を返す。 */
export function articlesNeedingEmbedding(db: DatabaseSync, limit: number): EmbedTarget[] {
  return all<EmbedTarget>(
    db,
    `SELECT a.id, a.title, a.summary, a.content
     FROM articles a
     LEFT JOIN article_embeddings e ON e.article_id = a.id
     WHERE e.article_id IS NULL AND a.is_duplicate = 0
       AND a.created_at >= datetime('now', '-30 days')
     ORDER BY a.created_at DESC LIMIT ?`,
    limit,
  );
}

export function storeEmbedding(
  db: DatabaseSync,
  articleId: number,
  embedding: number[],
  model: string,
): void {
  run(
    db,
    `INSERT OR REPLACE INTO article_embeddings (article_id, embedding, model, dim, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    articleId,
    JSON.stringify(embedding),
    model,
    embedding.length,
  );
}

interface EmbeddingRow {
  article_id: number;
  embedding: string;
}

/** 検索対象の embedding（直近30日・非重複）をロードして number[] にパースする。 */
export function loadEmbeddings(db: DatabaseSync): Array<{ articleId: number; vec: number[] }> {
  return all<EmbeddingRow>(
    db,
    `SELECT e.article_id, e.embedding
     FROM article_embeddings e
     JOIN articles a ON a.id = e.article_id
     WHERE a.is_duplicate = 0 AND a.created_at >= datetime('now', '-30 days')`,
  ).map((r) => ({ articleId: r.article_id, vec: JSON.parse(r.embedding) as number[] }));
}

export function embeddingCount(db: DatabaseSync): number {
  return get<{ c: number }>(db, 'SELECT count(*) c FROM article_embeddings')?.c ?? 0;
}
