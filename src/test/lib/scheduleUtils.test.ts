import { describe, expect, it } from 'vitest';
import {
  DAY_LABELS,
  DAYS_MAP,
  dateKey,
  fmtDate,
  fmtISO,
  getDayStart,
  getMonthStart,
  getWeekStart,
  groupAiring,
  groupGames,
} from '../../lib/scheduleUtils';
import type { AiringEntry, GameReleaseEntry } from '../../types';

describe('constants', () => {
  it('DAY_LABELS has 7 days starting with SUN', () => {
    expect(DAY_LABELS).toHaveLength(7);
    expect(DAY_LABELS[0]).toBe('SUN');
    expect(DAY_LABELS[6]).toBe('SAT');
  });

  it('DAYS_MAP has correct values', () => {
    expect(DAYS_MAP.day).toBe(1);
    expect(DAYS_MAP.week).toBe(7);
    expect(DAYS_MAP.month).toBe(31);
  });
});

describe('getWeekStart', () => {
  it('returns a Date for offset 0', () => {
    const result = getWeekStart(0);
    expect(result).toBeInstanceOf(Date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('shifts by 7 days per offset', () => {
    const week0 = getWeekStart(0);
    const week1 = getWeekStart(1);
    const diff = (week1.getTime() - week0.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(7);
  });
});

describe('getMonthStart', () => {
  it('returns first day of month', () => {
    const result = getMonthStart(0);
    expect(result.getDate()).toBe(1);
  });

  it('shifts by one month per offset', () => {
    const m0 = getMonthStart(0);
    const m1 = getMonthStart(1);
    const expectedMonth = (m0.getMonth() + 1) % 12;
    expect(m1.getMonth()).toBe(expectedMonth);
  });
});

describe('getDayStart', () => {
  it('returns midnight for offset 0', () => {
    const result = getDayStart(0);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('shifts by 1 day per offset', () => {
    const d0 = getDayStart(0);
    const d1 = getDayStart(1);
    const diff = (d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(1);
  });
});

describe('dateKey', () => {
  it('formats date as year-month-day', () => {
    const d = new Date(2026, 2, 27); // March 27, 2026 (month is 0-indexed)
    expect(dateKey(d)).toBe('2026-2-27');
  });
});

describe('fmtDate', () => {
  it('formats as month/day', () => {
    const d = new Date(2026, 2, 5);
    expect(fmtDate(d)).toBe('3/5');
  });
});

describe('fmtISO', () => {
  it('formats as YYYY-MM-DD', () => {
    // Use UTC noon to avoid timezone offset shifting the date
    const d = new Date(Date.UTC(2026, 2, 27, 12, 0, 0));
    expect(fmtISO(d)).toBe('2026-03-27');
  });
});

describe('groupAiring', () => {
  const makeAiring = (airingAt: number, id = 1): AiringEntry => ({
    id,
    episode: 1,
    airingAt,
    mediaId: 100,
    titleNative: null,
    titleRomaji: 'Test Anime',
    coverImageUrl: null,
    totalEpisodes: 12,
    siteUrl: null,
  });

  it('returns empty map for empty array', () => {
    expect(groupAiring([]).size).toBe(0);
  });

  it('groups entries by date', () => {
    const ts1 = new Date(2026, 2, 27, 10, 0).getTime() / 1000;
    const ts2 = new Date(2026, 2, 27, 14, 0).getTime() / 1000;
    const ts3 = new Date(2026, 2, 28, 10, 0).getTime() / 1000;

    const result = groupAiring([makeAiring(ts1, 1), makeAiring(ts2, 2), makeAiring(ts3, 3)]);
    expect(result.size).toBe(2);

    const key27 = dateKey(new Date(2026, 2, 27));
    expect(result.get(key27)).toHaveLength(2);
  });
});

describe('groupGames', () => {
  const makeGame = (released: string, id = 1): GameReleaseEntry => ({
    id,
    name: 'Test Game',
    released,
    platforms: ['PC'],
    backgroundImage: null,
    slug: 'test-game',
  });

  it('returns empty map for empty array', () => {
    expect(groupGames([]).size).toBe(0);
  });

  it('groups games by release date', () => {
    const result = groupGames([
      makeGame('2026-03-27', 1),
      makeGame('2026-03-27', 2),
      makeGame('2026-03-28', 3),
    ]);
    expect(result.size).toBe(2);
  });
});
