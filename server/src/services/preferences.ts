import type { DatabaseSync } from 'node:sqlite';
import { getInteractionStats, getTopInteractionTitles } from '../db/profile.ts';
import { routeFor } from '../llm/router.ts';
import { simpleRequest } from '../llm/types.ts';

// discover_profile.rs の suggest_preferences 移植。

export interface PreferenceSuggestion {
  suggestedTitles: string[];
  suggestedGenres: string[];
  suggestedCreators: string[];
  reason: string;
}

export async function suggestPreferences(db: DatabaseSync): Promise<PreferenceSuggestion> {
  const stats = getInteractionStats(db);
  const topTitles = getTopInteractionTitles(db, 20);

  if (topTitles.length === 0) {
    return {
      suggestedTitles: [],
      suggestedGenres: [],
      suggestedCreators: [],
      reason: 'まだ十分な閲覧データがありません',
    };
  }

  const statsText = stats.map((s) => `${s.category}: ${s.cnt}件`).join(', ');
  const req = simpleRequest(
    'ユーザーの閲覧行動データから趣味嗜好を推定してください。JSON形式で返してください:\n{"titles": ["作品名1"], "genres": ["ジャンル1"], "creators": ["クリエイター名1"], "reason": "推定理由"}\n各配列は3件以内。reason は20文字以内。',
    `カテゴリ別閲覧数: ${statsText}\n\nブックマーク/深堀りした記事:\n${topTitles.join('\n')}`,
    300,
  );

  try {
    const resp = await routeFor('summary').complete(req);
    const parsed = JSON.parse(resp.content) as Record<string, unknown>;
    const arr = (k: string): string[] => {
      const v = parsed[k];
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    };
    return {
      suggestedTitles: arr('titles'),
      suggestedGenres: arr('genres'),
      suggestedCreators: arr('creators'),
      reason: typeof parsed.reason === 'string' ? parsed.reason : '行動パターンから推定',
    };
  } catch {
    return {
      suggestedTitles: [],
      suggestedGenres: [],
      suggestedCreators: [],
      reason: 'AI 接続エラーまたは推定失敗',
    };
  }
}
