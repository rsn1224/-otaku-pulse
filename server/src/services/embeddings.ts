import type { DatabaseSync } from 'node:sqlite';
import { articlesNeedingEmbedding, loadEmbeddings, storeEmbedding } from '../db/embeddings.ts';
import { all } from '../db/query.ts';
import { embedText } from '../infra/embeddings.ts';
import { cosineSimilarity } from '../lib/vector.ts';
import { getLlmSettings } from '../llm/settings.ts';
import { type DiscoverArticleDto, type DiscoverRow, toDiscoverArticleDto } from '../types/dto.ts';

// ADR-7: 記事 embedding 化 + セマンティック検索。

const DISCOVER_COLS = `a.id, a.feed_id, a.title, a.url, a.summary, a.author,
  a.published_at, a.is_read, a.is_bookmarked, a.language, a.thumbnail_url, a.ai_summary,
  f.name AS feed_name, f.category AS category, a.impact_level,
  COALESCE(s.total_score, a.importance_score) AS total_score`;

function articleText(t: { title: string; summary: string | null; content: string | null }): string {
  const body = t.summary ?? t.content ?? '';
  return `${t.title}\n${body}`.slice(0, 2000);
}

/**
 * nomic-embed-text は `search_document:` / `search_query:` prefix で非対称検索の精度が大きく向上する。
 * prefix が無いと埋め込みが「日本語オタクニュース」という共通性に支配され、クエリに依らず同じ
 * 一般記事が上位に来てしまう（実測で確認）。非 nomic モデルでは prefix を付けない。
 * doc と query は同じ prefix 体系で埋め込む必要があるため、両側でこのヘルパーを使う。
 */
export function embedPrefix(model: string, role: 'document' | 'query'): string {
  return model.toLowerCase().includes('nomic') ? `search_${role}: ` : '';
}

/** 未 embedding の記事を最大 limit 件 embedding 化する。ollama 停止時は途中で打ち切る。 */
export async function embedArticles(db: DatabaseSync, limit = 50): Promise<number> {
  const targets = articlesNeedingEmbedding(db, limit);
  if (targets.length === 0) return 0;
  const s = getLlmSettings();
  const prefix = embedPrefix(s.embeddingModel, 'document');
  let count = 0;
  for (const t of targets) {
    try {
      const vec = await embedText(s.ollamaBaseUrl, s.embeddingModel, prefix + articleText(t));
      storeEmbedding(db, t.id, vec, s.embeddingModel);
      count += 1;
    } catch {
      break;
    }
  }
  return count;
}

/** クエリを embedding 化し、cosine で記事を意味検索する。 */
export async function semanticSearch(
  db: DatabaseSync,
  query: string,
  limit = 20,
): Promise<DiscoverArticleDto[]> {
  const s = getLlmSettings();
  const qvec = await embedText(
    s.ollamaBaseUrl,
    s.embeddingModel,
    embedPrefix(s.embeddingModel, 'query') + query,
  );
  const embeddings = loadEmbeddings(db);
  if (embeddings.length === 0) return [];

  const ids = embeddings
    .map((e) => ({ id: e.articleId, score: cosineSimilarity(qvec, e.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.id);
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const rows = all<DiscoverRow>(
    db,
    `SELECT ${DISCOVER_COLS} FROM articles a JOIN feeds f ON a.feed_id = f.id
     LEFT JOIN article_scores s ON a.id = s.article_id WHERE a.id IN (${placeholders})`,
    ...ids,
  );
  const byId = new Map(rows.map((r) => [r.id, toDiscoverArticleDto(r)]));
  return ids.map((id) => byId.get(id)).filter((x): x is DiscoverArticleDto => x !== undefined);
}

export interface RetrievedContext {
  id: number;
  title: string;
  url: string | null;
  summary: string | null;
  score: number;
}

interface ContextRow {
  id: number;
  title: string;
  url: string | null;
  summary: string | null;
}

/**
 * 純粋関数: query ベクトルと埋め込み集合から、excludeId 除外・minScore 閾値・上位 limit で
 * スコア付き id 列を返す（unit-testable）。
 */
export function rankEmbeddings(
  qvec: number[],
  embeddings: ReadonlyArray<{ articleId: number; vec: number[] }>,
  opts: { excludeId: number; limit: number; minScore: number },
): Array<{ id: number; score: number }> {
  return embeddings
    .filter((e) => e.articleId !== opts.excludeId)
    .map((e) => ({ id: e.articleId, score: cosineSimilarity(qvec, e.vec) }))
    .filter((r) => r.score >= opts.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit);
}

/**
 * deepdive grounding 用の scored retrieval。query を embedding 化し cosine 上位を返す。
 * semanticSearch と異なり、スコア保持・excludeId 除外・minScore 閾値でフィルタする。
 */
export async function retrieveRelated(
  db: DatabaseSync,
  query: string,
  opts: { excludeId: number; limit?: number; minScore?: number },
): Promise<RetrievedContext[]> {
  const limit = opts.limit ?? 4;
  // prefix 体系での実測キャリブレーション（nomic-embed-text）: 関連記事は ~0.6-0.63 に密集し
  // score 帯が狭いため precision を優先する。0.62 を floor にすると tangential な記事（~0.6-0.61）を
  // 除外でき、強い一致が無い記事は grounding なし（元記事のみ）に安全に degrade する。
  const minScore = opts.minScore ?? 0.62;
  const s = getLlmSettings();
  const qvec = await embedText(
    s.ollamaBaseUrl,
    s.embeddingModel,
    embedPrefix(s.embeddingModel, 'query') + query,
  );
  const embeddings = loadEmbeddings(db);
  if (embeddings.length === 0) return [];

  const ranked = rankEmbeddings(qvec, embeddings, { excludeId: opts.excludeId, limit, minScore });
  if (ranked.length === 0) return [];

  const placeholders = ranked.map(() => '?').join(',');
  const rows = all<ContextRow>(
    db,
    `SELECT id, title, url, summary FROM articles WHERE id IN (${placeholders})`,
    ...ranked.map((r) => r.id),
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ranked
    .map((r) => {
      const row = byId.get(r.id);
      return row === undefined ? undefined : { ...row, score: r.score };
    })
    .filter((x): x is RetrievedContext => x !== undefined);
}
