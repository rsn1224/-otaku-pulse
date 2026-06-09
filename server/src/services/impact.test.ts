import { describe, expect, test } from 'vitest';
import { classifyImpact } from './impact.ts';

// impact_classifier.rs の #[cfg(test)] を移植。

describe('classifyImpact', () => {
  test('confirmed keywords', () => {
    expect(classifyImpact('鬼滅の刃 映画化決定！公式発表', null)).toBe('confirmed');
    expect(classifyImpact('Release Date Confirmed for New Game', null)).toBe('confirmed');
  });
  test('rumor keywords', () => {
    expect(classifyImpact('新作アニメが来年放送との噂', null)).toBe('rumor');
    expect(classifyImpact('Leaked footage reportedly shows new season', null)).toBe('rumor');
  });
  test('general fallback', () => {
    expect(classifyImpact('アニメの感想まとめ', null)).toBe('general');
  });
  test('confirmed beats rumor', () => {
    expect(classifyImpact('噂レベルだったが発売日が公式発表', null)).toBe('confirmed');
  });
  test('content fallback', () => {
    expect(classifyImpact('ゲーム新情報', '発売日が公式に発表された')).toBe('confirmed');
  });
});
