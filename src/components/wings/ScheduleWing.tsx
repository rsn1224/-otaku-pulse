import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '../../lib/logger';
import {
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
import type { AiringEntry, GameReleaseEntry, ScheduleViewMode } from '../../types';
import { GameDayView, GameGridView } from '../schedule/GameViews';
import { ScheduleDayView, ScheduleGridView } from '../schedule/ScheduleGridView';
import { ToggleGroup } from '../schedule/ScheduleToggleGroup';

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
    } catch (e) {
      logger.warn({ error: e }, 'fetchScheduleData failed');
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
