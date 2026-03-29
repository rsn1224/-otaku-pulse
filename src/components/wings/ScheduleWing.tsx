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
import { getAiringSchedule, getGameReleases, isRawgApiKeySet } from '../../lib/tauri-commands';
import type { AiringEntry, GameReleaseEntry, ScheduleViewMode } from '../../types';
import { GameDayView, GameGridView } from '../schedule/GameViews';
import { ScheduleDayView, ScheduleGridView } from '../schedule/ScheduleGridView';
import { ToggleGroup } from '../schedule/ScheduleToggleGroup';
import { Spinner } from '../ui/Spinner';

type TabId = 'anime' | 'game';

export function ScheduleWing(): React.JSX.Element {
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('week');
  const [tab, setTab] = useState<TabId>('anime');
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<AiringEntry[]>([]);
  const [games, setGames] = useState<GameReleaseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rawgKeySet, setRawgKeySet] = useState<boolean | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  const checkRawgKey = useCallback(async () => {
    try {
      const isSet = await isRawgApiKeySet();
      setRawgKeySet(isSet);
      return isSet;
    } catch (e) {
      logger.warn({ error: e }, 'Failed to check RAWG API key status');
      setRawgKeySet(false);
      return false;
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      if (tab === 'anime') {
        const ts = Math.floor(startDate.getTime() / 1000);
        const result = await getAiringSchedule(ts, DAYS_MAP[viewMode]);
        setEntries(result);
      } else {
        const keySet = await checkRawgKey();
        if (!keySet) {
          setGames([]);
          return;
        }
        const result = await getGameReleases(fmtISO(startDate), fmtISO(endDate));
        setGames(result);
      }
    } catch (e) {
      logger.warn({ error: e }, 'fetchScheduleData failed');
      const message =
        typeof e === 'object' && e !== null && 'message' in e
          ? (e as { message: string }).message
          : 'データの取得に失敗しました';
      setFetchError(message);
      setEntries([]);
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  }, [tab, startDate, endDate, viewMode, checkRawgKey]);

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
    return `${fmtDate(dates[0]!)} — ${fmtDate(dates[dates.length - 1]!)}`;
  }, [viewMode, startDate, dates]);

  const renderContent = (): React.ReactNode => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      );
    }
    if (fetchError !== null) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <p className="text-(--on-surface-variant) text-sm">データの取得に失敗しました</p>
          <p className="text-(--outline) text-xs">{fetchError}</p>
        </div>
      );
    }
    if (tab === 'game' && rawgKeySet === false) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <p className="text-(--on-surface-variant) text-sm">RAWG API キーが未設定です</p>
          <p className="text-(--outline) text-xs">
            プロフィール &gt; API キー タブから設定してください
          </p>
        </div>
      );
    }
    if (tab === 'anime') {
      if (viewMode === 'day')
        return (
          <ScheduleDayView date={dates[0]!} entries={groupedAiring.get(dateKey(dates[0]!)) ?? []} />
        );
      return <ScheduleGridView dates={dates} grouped={groupedAiring} viewMode={viewMode} />;
    }
    if (viewMode === 'day')
      return <GameDayView date={dates[0]!} games={groupedGames.get(dateKey(dates[0]!)) ?? []} />;
    return <GameGridView dates={dates} grouped={groupedGames} viewMode={viewMode} />;
  };

  return (
    <div className="h-full flex flex-col bg-(--surface)">
      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-(--on-surface)">Schedule</h1>
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
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-(--surface-container) text-(--on-surface-variant)"
          >
            {'←'}
          </button>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="px-2.5 h-7 text-[11px] rounded-lg font-semibold bg-(--primary) text-[#0e0e13]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-(--surface-container) text-(--on-surface-variant)"
          >
            {'→'}
          </button>
        </div>
      </div>
      <p className="px-6 text-xs font-medium tracking-wide mb-2 text-(--on-surface-variant)">
        {headerText}
      </p>
      <div className="flex-1 overflow-auto px-4 pb-4">{renderContent()}</div>
    </div>
  );
}
