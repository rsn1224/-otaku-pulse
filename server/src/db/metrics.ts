import type { DatabaseSync } from 'node:sqlite';
import { all, get, run } from './query.ts';

// ADR-13 オブザーバビリティ。LLM 呼出計測の sink（書き込み）と集計（読み取り）。
// 計測は cross-cutting なため、router seam から db を持たずに記録できるよう
// 起動時に sink を 1 度設定する（アプリの db 接続は単一・生存期間中不変）。

let sink: DatabaseSync | null = null;

/** 起動時に 1 度だけ呼ぶ。LLM 計測の書き込み先 DB を設定する。 */
export function initMetrics(db: DatabaseSync): void {
  sink = db;
}

export interface LlmCallMetric {
  provider: string;
  model: string;
  task: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costUsd: number;
}

/**
 * LLM 呼出を 1 件記録する。initMetrics 未設定（unit test 等）では no-op。
 * 計測の失敗は握り潰す（観測のために本処理を落とさない）。
 */
export function recordLlmCall(m: LlmCallMetric): void {
  if (sink === null) return;
  try {
    run(
      sink,
      `INSERT INTO llm_metrics
         (provider, model, task, prompt_tokens, completion_tokens, latency_ms, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      m.provider,
      m.model,
      m.task,
      m.promptTokens,
      m.completionTokens,
      m.latencyMs,
      m.costUsd,
    );
  } catch {
    // 計測失敗は無視
  }
}

export interface LlmTotals {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface LlmModelStat {
  provider: string;
  model: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface LlmTaskStat {
  task: string;
  calls: number;
  costUsd: number;
  avgLatencyMs: number;
}

export function getLlmTotals(db: DatabaseSync): LlmTotals {
  const r = get<{
    calls: number;
    p: number;
    c: number;
    cost: number;
    lat: number;
  }>(
    db,
    `SELECT COUNT(*) AS calls,
       COALESCE(SUM(prompt_tokens), 0) AS p,
       COALESCE(SUM(completion_tokens), 0) AS c,
       COALESCE(SUM(cost_usd), 0) AS cost,
       COALESCE(AVG(latency_ms), 0) AS lat
     FROM llm_metrics`,
  );
  return {
    calls: r?.calls ?? 0,
    promptTokens: r?.p ?? 0,
    completionTokens: r?.c ?? 0,
    costUsd: r?.cost ?? 0,
    avgLatencyMs: Math.round(r?.lat ?? 0),
  };
}

export function getLlmByModel(db: DatabaseSync): LlmModelStat[] {
  return all<{
    provider: string;
    model: string;
    calls: number;
    p: number;
    c: number;
    cost: number;
    lat: number;
  }>(
    db,
    `SELECT provider, model, COUNT(*) AS calls,
       COALESCE(SUM(prompt_tokens), 0) AS p,
       COALESCE(SUM(completion_tokens), 0) AS c,
       COALESCE(SUM(cost_usd), 0) AS cost,
       COALESCE(AVG(latency_ms), 0) AS lat
     FROM llm_metrics
     GROUP BY provider, model
     ORDER BY cost DESC, calls DESC`,
  ).map((r) => ({
    provider: r.provider,
    model: r.model,
    calls: r.calls,
    promptTokens: r.p,
    completionTokens: r.c,
    costUsd: r.cost,
    avgLatencyMs: Math.round(r.lat),
  }));
}

export function getLlmByTask(db: DatabaseSync): LlmTaskStat[] {
  return all<{ task: string; calls: number; cost: number; lat: number }>(
    db,
    `SELECT task, COUNT(*) AS calls,
       COALESCE(SUM(cost_usd), 0) AS cost,
       COALESCE(AVG(latency_ms), 0) AS lat
     FROM llm_metrics
     GROUP BY task
     ORDER BY calls DESC`,
  ).map((r) => ({
    task: r.task,
    calls: r.calls,
    costUsd: r.cost,
    avgLatencyMs: Math.round(r.lat),
  }));
}

export interface CollectionMetrics {
  totalArticles: number;
  duplicates: number;
  dedupRate: number;
  byCategory: Array<{ category: string; count: number }>;
}

/** pipeline metrics: 収集件数・dedup 率・カテゴリ別件数。 */
export function getCollectionMetrics(db: DatabaseSync): CollectionMetrics {
  const counts = get<{ total: number; dup: number }>(
    db,
    'SELECT COUNT(*) AS total, COALESCE(SUM(is_duplicate), 0) AS dup FROM articles',
  );
  const total = counts?.total ?? 0;
  const dup = counts?.dup ?? 0;
  const byCategory = all<{ category: string; count: number }>(
    db,
    `SELECT f.category AS category, COUNT(*) AS count
     FROM articles a JOIN feeds f ON a.feed_id = f.id
     WHERE a.is_duplicate = 0
     GROUP BY f.category
     ORDER BY count DESC`,
  );
  return {
    totalArticles: total,
    duplicates: dup,
    dedupRate: total > 0 ? dup / total : 0,
    byCategory,
  };
}
