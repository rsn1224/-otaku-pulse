import type { DatabaseSync } from 'node:sqlite';
import { loadRescoreInputs, type ScoreRow, upsertScores } from '../db/scores.ts';
import { composeScore } from './scoring.ts';

// ADR-6 unified scoring の rescore エントリ。
// 非重複の全記事について base(importance_score) + impact + 暗黙FB を合成し
// article_scores に永続化する。FE は収集後・設定変更後に rescore_articles で呼ぶ。

/** 全記事を再スコアし、書き込み件数を返す。 */
export function rescoreArticles(db: DatabaseSync): number {
  const inputs = loadRescoreInputs(db);
  const rows: ScoreRow[] = inputs.map((i) => {
    const c = composeScore({
      base: i.importance_score,
      impact: i.impact_level ?? 'general',
      engagement: i.engagement,
    });
    return { articleId: i.id, base: c.base, personal: c.personal, total: c.total };
  });
  return upsertScores(db, rows);
}
