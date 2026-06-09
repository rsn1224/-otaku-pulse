import { describe, expect, test } from 'vitest';
import {
  generateContentHash,
  jaccardBigramSimilarity,
  normalizeTitle,
  normalizeUrl,
} from './dedup.ts';

// dedup_service.rs の #[cfg(test)] を移植（Rust とのパリティ保証）。

describe('normalizeUrl', () => {
  test('removes tracking params', () => {
    expect(normalizeUrl('https://example.com/article?utm_source=twitter&id=123')).toBe(
      'https://example.com/article?id=123',
    );
  });
  test('http -> https + strips www', () => {
    expect(normalizeUrl('http://www.example.com/path/')).toBe('https://example.com/path');
  });
  test('removes fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });
  test('param order independent', () => {
    expect(normalizeUrl('https://example.com/page?b=2&a=1')).toBe(
      normalizeUrl('https://example.com/page?a=1&b=2'),
    );
  });
  test('keeps non-tracking params, drops tracking', () => {
    const n = normalizeUrl('https://example.com/page?id=1&utm_source=rss&tab=news');
    expect(n).not.toContain('utm_source');
    expect(n).toContain('id=1');
    expect(n).toContain('tab=news');
  });
  test('mixed-case host lowercased', () => {
    expect(normalizeUrl('https://EXAMPLE.Com/path')).toContain('example.com');
  });
});

describe('normalizeTitle', () => {
  test('strips symbols', () => {
    expect(normalizeTitle('「進撃の巨人」最終回！')).toBe('進撃の巨人最終回');
  });
  test('NFKC half-width katakana == full-width', () => {
    const half = 'ｶﾞﾝﾀﾞﾑ';
    expect(normalizeTitle(half)).toBe(normalizeTitle('ガンダム'));
  });
  test('NFKC full-width ASCII == half-width', () => {
    expect(normalizeTitle('Ａｎｉｍｅ')).toBe(normalizeTitle('Anime'));
  });
});

describe('jaccardBigramSimilarity', () => {
  test('identical == 1', () => {
    expect(jaccardBigramSimilarity('進撃の巨人', '進撃の巨人')).toBeCloseTo(1.0, 2);
  });
  test('different < 0.2', () => {
    expect(jaccardBigramSimilarity('天気予報', '株式市場')).toBeLessThan(0.2);
  });
  test('both empty == 1, one empty == 0', () => {
    expect(jaccardBigramSimilarity('', '')).toBeCloseTo(1.0, 2);
    expect(jaccardBigramSimilarity('abc', '')).toBeCloseTo(0.0, 2);
  });
  test('similar titles >= 0.4', () => {
    expect(
      jaccardBigramSimilarity('進撃の巨人 最終回', '「進撃の巨人」最終回放送決定'),
    ).toBeGreaterThanOrEqual(0.4);
  });
});

describe('generateContentHash', () => {
  test('64 hex chars, deterministic', () => {
    const h = generateContentHash('Hello World');
    expect(h).toHaveLength(64);
    expect(h).toBe(generateContentHash('Hello World'));
  });
  test('NFKC consistency: half-width == full-width', () => {
    const half = 'ｶﾞﾝﾀﾞﾑ';
    expect(generateContentHash(half)).toBe(generateContentHash('ガンダム'));
  });
  test('empty string yields valid hash', () => {
    expect(generateContentHash('')).toHaveLength(64);
  });
});
