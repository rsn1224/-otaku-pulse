import type { DatabaseSync } from 'node:sqlite';
import { getInteractionStats, getTopInteractionTitles } from '../db/profile.ts';
import { routeFor } from '../llm/router.ts';
import { preferencesPrompt } from './prompts/registry.ts';
import { buildRequest } from './prompts/types.ts';

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
  const req = buildRequest(preferencesPrompt, { statsText, topTitles });

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
