import { describe, expect, test } from 'vitest';
import {
  composeScore,
  DEFAULT_FACTORS,
  ENGAGEMENT_WEIGHTS,
  type ScoringFactor,
} from './scoring.ts';

describe('composeScore (ADR-6 統一スコア)', () => {
  test('base のみ: base/personal/total を返す', () => {
    const c = composeScore({ base: 0.5, impact: 'general', engagement: 0 });
    expect(c.base).toBe(0.5);
    expect(c.personal).toBe(0);
    // 1.0*0.5 + 0.15*0.5 + 0.5*0 = 0.575
    expect(c.total).toBeCloseTo(0.575, 5);
  });

  test('confirmed impact は general より total を押し上げる', () => {
    const confirmed = composeScore({ base: 0.5, impact: 'confirmed', engagement: 0 });
    const general = composeScore({ base: 0.5, impact: 'general', engagement: 0 });
    const rumor = composeScore({ base: 0.5, impact: 'rumor', engagement: 0 });
    expect(confirmed.total).toBeGreaterThan(general.total);
    expect(general.total).toBeGreaterThan(rumor.total);
  });

  test('engagement は personal を上げ total を押し上げる (saturating)', () => {
    const none = composeScore({ base: 0.5, impact: 'general', engagement: 0 });
    const some = composeScore({ base: 0.5, impact: 'general', engagement: 5 });
    const lots = composeScore({ base: 0.5, impact: 'general', engagement: 100 });
    // raw=5 → personal = 5/(5+5) = 0.5
    expect(some.personal).toBeCloseTo(0.5, 5);
    expect(some.total).toBeGreaterThan(none.total);
    // 飽和: personal は 1 に漸近するが超えない
    expect(lots.personal).toBeLessThan(1);
    expect(lots.personal).toBeGreaterThan(some.personal);
  });

  test('base は 0..1 にクランプされる', () => {
    expect(composeScore({ base: 1.5, impact: 'general', engagement: 0 }).base).toBe(1);
    expect(composeScore({ base: -0.5, impact: 'general', engagement: 0 }).base).toBe(0);
  });

  test('カスタム因子で既定の重みを上書きできる (pluggable)', () => {
    const baseOnly: ScoringFactor[] = [{ name: 'base', weight: 1.0, value: (s) => s.base }];
    const c = composeScore({ base: 0.7, impact: 'confirmed', engagement: 100 }, baseOnly);
    expect(c.total).toBeCloseTo(0.7, 5); // impact/personal は寄与しない
  });

  test('ENGAGEMENT_WEIGHTS が discover の live クエリと一致 (bookmark>deepdive>open)', () => {
    expect(ENGAGEMENT_WEIGHTS.bookmark).toBe(3.0);
    expect(ENGAGEMENT_WEIGHTS.deepdive).toBe(2.5);
    expect(ENGAGEMENT_WEIGHTS.open).toBe(1.0);
  });

  test('DEFAULT_FACTORS は base/impact/personal の 3 因子', () => {
    expect(DEFAULT_FACTORS.map((f) => f.name)).toEqual(['base', 'impact', 'personal']);
  });
});
