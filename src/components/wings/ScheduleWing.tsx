import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AiringEntry, GameReleaseEntry, ScheduleViewMode } from '../../types';
import { GameReleaseCard } from '../schedule/GameReleaseCard';
import { ScheduleDayView, ScheduleGridView } from '../schedule/ScheduleGridView';

const getWeekStart = (offset: number): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((d + 6) % 7) + offset * 7);
  return mon;
};
const getMonthStart = (offset: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
};
const getDayStart = (offset: number): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() + offset);
  return now;
};

const dateKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const fmtDate = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()}`;
const fmtISO = (d: Date): string => d.toISOString().slice(0, 10);

const groupAiring = (entries: AiringEntry[]): Map<string, AiringEntry[]> => {
  const map = new Map<string, AiringEntry[]>();
  for (const e of entries) {
    const k = dateKey(new Date(e.airingAt * 1000));
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return map;
};

const groupGames = (games: GameReleaseEntry[]): Map<string, GameReleaseEntry[]> => {
  const map = new Map<string, GameReleaseEntry[]>();
  for (const g of games) {
    const d = new Date(g.released);
    const k = dateKey(d);
    map.set(k, [...(map.get(k) ?? []), g]);
  }
  return map;
};

const DAYS_MAP: Record<ScheduleViewMode, number> = { day: 1, week: 7, month: 31 };
type TabId = 'anime' | 'game';

export const ScheduleWing: React.FC = () => {
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('week');
  const [tab, setTab] = useState<TabId>('anime');
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<AiringEntry[]>([]);
  const [games, setGames] = useState<GameReleaseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const startDate = useMemo(() => {
    if (viewMode === 'day') return getDayStart(offset);
    if (viewMode === 'month') return getMonthStart(offset);
    return getWeekStart(offset);
  }, [viewMode, offset]);

  const endDate = useMemo(() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + DAYS_MAP[viewMode]);
    return d;
  }, [startDate, viewMode]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (tab === 'anime') {
        const ts = Math.floor(startDate.getTime() / 1000);
        const result = await invoke<AiringEntry[]>('get_airing_schedule', {
          startTimestamp: ts,
          daysAhead: DAYS_MAP[viewMode],
        });
        setEntries(result);
      } else {
        const result = await invoke<GameReleaseEntry[]>('get_game_releases', {
          startDate: fmtISO(startDate),
          endDate: fmtISO(endDate),
        });
        setGames(result);
      }
    } catch (_) {
      setEntries([]);
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  }, [tab, startDate, endDate, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groupedAiring = useMemo(() => groupAiring(entries), [entries]);
  const groupedGames = useMemo(() => groupGames(games), [games]);

  const dates = useMemo(
    () =>
      Array.from({ length: DAYS_MAP[viewMode] }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        return d;
      }),
    [startDate, viewMode],
  );

  const headerText = useMemo(() => {
    if (viewMode === 'day')
      return startDate.toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      });
    if (viewMode === 'month')
      return startDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
    return `${fmtDate(dates[0])} — ${fmtDate(dates[dates.length - 1])}`;
  }, [viewMode, startDate, dates]);

  const renderContent = (): React.ReactNode => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin border-[var(--border)] border-t-[var(--accent)]" />
        </div>
      );
    }
    if (tab === 'anime') {
      if (viewMode === 'day')
        return (
          <ScheduleDayView date={dates[0]} entries={groupedAiring.get(dateKey(dates[0])) ?? []} />
        );
      return <ScheduleGridView dates={dates} grouped={groupedAiring} viewMode={viewMode} />;
    }
    // Game calendar
    if (viewMode === 'day')
      return <GameDayView date={dates[0]} games={groupedGames.get(dateKey(dates[0])) ?? []} />;
    return <GameGridView dates={dates} grouped={groupedGames} viewMode={viewMode} />;
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Schedule</h1>
          <ToggleGroup
            items={[
              { id: 'anime', label: 'Anime' },
              { id: 'game', label: 'Games' },
            ]}
            active={tab}
            onSelect={(t) => {
              setTab(t as TabId);
              setOffset(0);
            }}
            accent
          />
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            items={[
              { id: 'day', label: 'Day' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
            ]}
            active={viewMode}
            onSelect={(m) => {
              setViewMode(m as ScheduleViewMode);
              setOffset(0);
            }}
          />
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)]"
          >
            {'←'}
          </button>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="px-2.5 h-7 text-[11px] rounded-lg font-semibold bg-[var(--accent)] text-[#0e0e13]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)]"
          >
            {'→'}
          </button>
        </div>
      </div>
      <p className="px-6 text-xs font-medium tracking-wide mb-2 text-[var(--text-secondary)]">
        {headerText}
      </p>
      <div className="flex-1 overflow-auto px-4 pb-4">{renderContent()}</div>
    </div>
  );
};

const ToggleGroup: React.FC<{
  items: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  accent?: boolean;
}> = ({ items, active, onSelect, accent }) => (
  <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelect(item.id)}
        className="px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors"
        style={{
          background:
            active === item.id
              ? accent
                ? 'var(--accent)'
                : 'var(--bg-card-hover)'
              : 'transparent',
          color:
            active === item.id
              ? accent
                ? '#0e0e13'
                : 'var(--text-primary)'
              : 'var(--text-tertiary)',
        }}
      >
        {item.label}
      </button>
    ))}
  </div>
);

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const GameDayView: React.FC<{ date: Date; games: GameReleaseEntry[] }> = ({ date, games }) => (
  <div className="max-w-lg mx-auto space-y-2">
    <h2 className="text-sm font-bold mb-3 text-[#699cff]">
      {date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })}
      {' — '}
      {games.length} 件
    </h2>
    {games.map((g) => (
      <GameReleaseCard key={g.id} game={g} />
    ))}
    {games.length === 0 && <p className="text-xs py-4 text-[var(--text-tertiary)]">発売なし</p>}
  </div>
);

const GameGridView: React.FC<{
  dates: Date[];
  grouped: Map<string, GameReleaseEntry[]>;
  viewMode: ScheduleViewMode;
}> = ({ dates, grouped, viewMode }) => (
  <div className={viewMode === 'month' ? 'grid grid-cols-7 gap-1' : 'flex gap-3 min-w-[900px]'}>
    {dates.map((date) => {
      const k = dateKey(date);
      const dayGames = grouped.get(k) ?? [];
      const isToday = new Date().toDateString() === date.toDateString();
      return (
        <div
          key={k}
          className={
            viewMode === 'month'
              ? 'min-h-[80px] p-1 rounded overflow-hidden'
              : dayGames.length > 0
                ? 'flex-1 min-w-[140px] flex flex-col'
                : 'w-[60px] flex-shrink-0 flex flex-col'
          }
          style={
            viewMode === 'month'
              ? { background: isToday ? 'rgba(105,156,255,0.08)' : 'transparent' }
              : undefined
          }
        >
          <div
            className={viewMode === 'month' ? 'mb-1' : 'py-2 mb-2'}
            style={
              viewMode === 'week'
                ? { borderBottom: isToday ? '2px solid #699cff' : '1px solid rgba(72,71,77,0.1)' }
                : undefined
            }
          >
            {viewMode === 'week' && (
              <h3
                className="text-xs font-bold"
                style={{ color: isToday ? '#699cff' : 'var(--text-secondary)' }}
              >
                {DAY_LABELS[date.getDay()]}
              </h3>
            )}
            <p
              className="text-[10px] font-bold"
              style={{ color: isToday ? '#699cff' : 'var(--text-tertiary)' }}
            >
              {fmtDate(date)}
            </p>
          </div>
          <div className={viewMode === 'month' ? 'space-y-0.5' : 'flex flex-col gap-2'}>
            {dayGames.map((g) =>
              viewMode === 'month' ? (
                <p
                  key={g.id}
                  className="text-[9px] truncate text-[var(--text-secondary)]"
                  title={g.name}
                >
                  {g.name}
                </p>
              ) : (
                <GameReleaseCard key={g.id} game={g} />
              ),
            )}
            {viewMode === 'week' && dayGames.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)]">—</p>
            )}
          </div>
        </div>
      );
    })}
  </div>
);
