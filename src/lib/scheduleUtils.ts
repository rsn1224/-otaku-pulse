import type { AiringEntry, GameReleaseEntry, ScheduleViewMode } from '../types';

export const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export const DAYS_MAP: Record<ScheduleViewMode, number> = { day: 1, week: 7, month: 31 };

export const getWeekStart = (offset: number): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((d + 6) % 7) + offset * 7);
  return mon;
};

export const getMonthStart = (offset: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
};

export const getDayStart = (offset: number): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() + offset);
  return now;
};

export const dateKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const fmtDate = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()}`;
export const fmtISO = (d: Date): string => d.toISOString().slice(0, 10);

export const groupAiring = (entries: AiringEntry[]): Map<string, AiringEntry[]> => {
  const map = new Map<string, AiringEntry[]>();
  for (const e of entries) {
    const k = dateKey(new Date(e.airingAt * 1000));
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return map;
};

export const groupGames = (games: GameReleaseEntry[]): Map<string, GameReleaseEntry[]> => {
  const map = new Map<string, GameReleaseEntry[]>();
  for (const g of games) {
    const d = new Date(g.released);
    const k = dateKey(d);
    map.set(k, [...(map.get(k) ?? []), g]);
  }
  return map;
};
