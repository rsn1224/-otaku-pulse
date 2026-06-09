import { describe, expect, it } from 'vitest';
import { parseDeepDiveStreamRaw } from '../../lib/tauri-commands';

// grounded deepdive: streaming 本文（answer / ---FOLLOWUP--- / ---CITATIONS---）のパース。

describe('parseDeepDiveStreamRaw', () => {
  it('answer / followups / citations をすべて分離する', () => {
    const raw = [
      '回答本文です。',
      '---FOLLOWUP---',
      '["追加質問1", "追加質問2"]',
      '---CITATIONS---',
      '[{"url":"https://a","title":"記事A"},{"url":"https://b","title":null}]',
    ].join('\n');
    const r = parseDeepDiveStreamRaw(raw, 'Q');
    expect(r.answer).toBe('回答本文です。');
    expect(r.followUpQuestions).toEqual(['追加質問1', '追加質問2']);
    expect(r.citations).toEqual([
      { url: 'https://a', title: '記事A' },
      { url: 'https://b', title: null },
    ]);
  });

  it('followup 正規表現が citations 配列を飲み込まない', () => {
    const raw = '本文\n---FOLLOWUP---\n["fu1"]\n---CITATIONS---\n[{"url":"https://x","title":"X"}]';
    const r = parseDeepDiveStreamRaw(raw, 'Q');
    // 貪欲マッチが citations までスパンすると followUpQuestions が壊れる（回帰防止）。
    expect(r.followUpQuestions).toEqual(['fu1']);
    expect(r.citations).toEqual([{ url: 'https://x', title: 'X' }]);
  });

  it('CITATIONS ブロックが無い場合は citations 空（degrade）', () => {
    const raw = '本文\n---FOLLOWUP---\n["fu1", "fu2"]';
    const r = parseDeepDiveStreamRaw(raw, 'Q');
    expect(r.answer).toBe('本文');
    expect(r.followUpQuestions).toEqual(['fu1', 'fu2']);
    expect(r.citations).toEqual([]);
  });

  it('delimiter が一切無い素の回答', () => {
    const r = parseDeepDiveStreamRaw('ただの回答', 'Q');
    expect(r.answer).toBe('ただの回答');
    expect(r.followUpQuestions).toEqual([]);
    expect(r.citations).toEqual([]);
  });

  it('url を持たない citation エントリは除外', () => {
    const raw = '本文\n---CITATIONS---\n[{"title":"no url"},{"url":"https://ok","title":"OK"}]';
    const r = parseDeepDiveStreamRaw(raw, 'Q');
    expect(r.citations).toEqual([{ url: 'https://ok', title: 'OK' }]);
  });
});
