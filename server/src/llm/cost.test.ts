import { describe, expect, test } from 'vitest';
import { estimateCostUsd, estimateTokens } from './cost.ts';

describe('estimateCostUsd (ADR-13 コスト推定)', () => {
  test('opus: input 15 / output 75 per 1M', () => {
    expect(estimateCostUsd('claude-opus-4-8', 1_000_000, 1_000_000)).toBeCloseTo(90, 6);
    expect(estimateCostUsd('claude-opus-4-8', 1_000_000, 0)).toBeCloseTo(15, 6);
  });

  test('sonnet / sonar-pro: 3 / 15 per 1M', () => {
    expect(estimateCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
    expect(estimateCostUsd('sonar-pro', 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
  });

  test('haiku: 0.8 / 4 per 1M', () => {
    expect(estimateCostUsd('claude-haiku-4-5', 1_000_000, 1_000_000)).toBeCloseTo(4.8, 6);
  });

  test('ローカル / 未知モデルは 0', () => {
    expect(estimateCostUsd('qwen3:14b', 1_000_000, 1_000_000)).toBe(0);
    expect(estimateCostUsd('some-unknown-model', 1_000_000, 1_000_000)).toBe(0);
  });
});

describe('estimateTokens', () => {
  test('空文字は 0', () => {
    expect(estimateTokens('')).toBe(0);
  });

  test('~4 chars/token で切り上げ', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2); // ceil(5/4)
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });
});
