import type { DatabaseSync } from 'node:sqlite';
import { all } from './query.ts';

// highlights_helpers.rs の get_trending_keywords 移植。

export interface TrendKeyword {
  keyword: string;
  count: number;
}

const MIN_KEYWORD_LENGTH = 4; // バイト長（Rust の str.len() に合わせる）
const MIN_KEYWORD_COUNT = 3;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'this',
  'with',
  'from',
  'your',
  'have',
  'are',
  'was',
  'will',
  'can',
  'has',
  'more',
  'about',
  'into',
  'than',
  'its',
  'been',
  'most',
  'just',
  'over',
  'also',
  'after',
  'http',
  'https',
  'www',
  'html',
  'nbsp',
]);

export function getTrendingKeywords(db: DatabaseSync): TrendKeyword[] {
  const rows = all<{ title: string }>(
    db,
    `SELECT title FROM articles
     WHERE is_duplicate = 0 AND published_at >= datetime('now', '-3 days')
     ORDER BY published_at DESC LIMIT 500`,
  );

  const counts = new Map<string, number>();
  for (const { title } of rows) {
    // 英数字 + アポストロフィ/ハイフン以外で分割（Rust の is_alphanumeric 相当）。
    for (const word of title.split(/[^\p{L}\p{N}'-]+/u)) {
      const w = word.trim().toLowerCase();
      if (Buffer.byteLength(w, 'utf8') >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(w)) {
        counts.set(w, (counts.get(w) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_KEYWORD_COUNT)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}
