import type { DatabaseSync } from 'node:sqlite';
import type { ImpactLevel } from '../services/impact.ts';
import { all, run } from './query.ts';

// article_scores (パーソナルスコアキャッシュ, migration 004) の read/write。
// rescore (services/rescore.ts) が唯一の書き込み元。discover の COALESCE(s.total_score, ...)
// が参照する。

/** rescore の入力 1 行。engagement は暗黙FB の重み付き raw 合計。 */
export interface RescoreInput {
  id: number;
  importance_score: number;
  impact_level: ImpactLevel | null;
  engagement: number;
}

// 暗黙FB の action 別重みは services/scoring.ts ENGAGEMENT_WEIGHTS と一致させる。
const RESCORE_INPUT_SQL = `SELECT a.id, a.importance_score, a.impact_level,
    COALESCE(SUM(CASE ai.action
      WHEN 'bookmark' THEN 3.0
      WHEN 'deepdive' THEN 2.5
      WHEN 'open' THEN 1.0
      ELSE 0 END), 0) AS engagement
  FROM articles a
  LEFT JOIN article_interactions ai ON ai.article_id = a.id
  WHERE a.is_duplicate = 0
  GROUP BY a.id`;

/** 非重複の全記事について base + 暗黙FB raw を取得する。 */
export function loadRescoreInputs(db: DatabaseSync): RescoreInput[] {
  return all<RescoreInput>(db, RESCORE_INPUT_SQL);
}

/** article_scores に書き込む 1 行。 */
export interface ScoreRow {
  articleId: number;
  base: number;
  personal: number;
  total: number;
}

const UPSERT_SQL = `INSERT INTO article_scores (article_id, base_score, personal_score, total_score, scored_at)
  VALUES (?, ?, ?, ?, datetime('now'))
  ON CONFLICT(article_id) DO UPDATE SET
    base_score = excluded.base_score,
    personal_score = excluded.personal_score,
    total_score = excluded.total_score,
    scored_at = excluded.scored_at`;

/** 合成済みスコアを 1 トランザクションで upsert し、書き込み件数を返す。 */
export function upsertScores(db: DatabaseSync, rows: ScoreRow[]): number {
  if (rows.length === 0) return 0;
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      run(db, UPSERT_SQL, r.articleId, r.base, r.personal, r.total);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return rows.length;
}
