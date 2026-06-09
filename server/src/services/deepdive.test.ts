import { describe, expect, test } from 'vitest';
import { buildGroundedUserPrompt, contextsToCitations, mergeCitations } from './deepdive.ts';
import type { RetrievedContext } from './embeddings.ts';

const ctx = (
  id: number,
  title: string,
  url: string | null,
  summary: string | null,
): RetrievedContext => ({ id, title, url, summary, score: 0.9 });

describe('buildGroundedUserPrompt', () => {
  test('contexts が空なら関連記事セクション無し', () => {
    const p = buildGroundedUserPrompt('元タイトル', '元サマリー', '質問です', []);
    expect(p).not.toContain('関連する収集済み記事');
    expect(p).toContain('質問: 質問です');
  });

  test('contexts があれば番号付きで関連記事を挿入', () => {
    const p = buildGroundedUserPrompt('T', 'S', 'Q', [
      ctx(1, 'A記事', 'https://a', 'a要約'),
      ctx(2, 'B記事', null, null),
    ]);
    expect(p).toContain('関連する収集済み記事:');
    expect(p).toContain('[1] A記事 — a要約');
    expect(p).toContain('[2] B記事 — ');
    expect(p.indexOf('関連する収集済み記事')).toBeLessThan(p.indexOf('質問: Q'));
  });
});

describe('contextsToCitations', () => {
  test('url が null の記事は除外', () => {
    const cites = contextsToCitations([ctx(1, 'A', 'https://a', null), ctx(2, 'B', null, null)]);
    expect(cites).toEqual([{ url: 'https://a', title: 'A' }]);
  });
});

describe('mergeCitations', () => {
  test('local 優先・url で重複排除', () => {
    const web = [
      { url: 'https://x', title: 'WebX' },
      { url: 'https://dup', title: 'WebDup' },
    ];
    const local = [
      { url: 'https://dup', title: 'LocalDup' },
      { url: 'https://y', title: 'LocalY' },
    ];
    expect(mergeCitations(web, local)).toEqual([
      { url: 'https://dup', title: 'LocalDup' },
      { url: 'https://y', title: 'LocalY' },
      { url: 'https://x', title: 'WebX' },
    ]);
  });
});
