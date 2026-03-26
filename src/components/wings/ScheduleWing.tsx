import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AiringEntry,
  DiscoverArticleDto,
  DiscoverFeedResult,
  ScheduleViewMode,
} from '../../types';
import { GameArticleCard } from '../schedule/GameArticleCard';
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

const groupByDate = (entries: AiringEntry[]): Map<string, AiringEntry[]> => {
  const map = new Map<string, AiringEntry[]>();
  for (const e of entries) {
    const k = dateKey(new Date(e.airingAt * 1000));
    map.set(k, [...(map.get(k) ?? []), e]);
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
  const [gameArticles, setGameArticles] = useState<DiscoverArticleDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const startDate = useMemo(() => {
    if (viewMode === 'day') return getDayStart(offset);
    if (viewMode === 'month') return getMonthStart(offset);
    return getWeekStart(offset);
  }, [viewMode, offset]);

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
        const result = await invoke<DiscoverFeedResult>('get_discover_feed', {
          tab: 'game',
          limit: 50,
          offset: 0,
        });
        setGameArticles(result.articles);
      }
    } catch (_) {
      setEntries([]);
      setGameArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, [tab, startDate, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const grouped = useMemo(() => groupByDate(entries), [entries]);
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

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Schedule
          </h1>
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
          {tab === 'anime' && (
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
          )}
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
          >
            {'←'}
          </button>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="px-2.5 h-7 text-[11px] rounded-lg font-semibold"
            style={{ background: 'var(--accent)', color: '#0e0e13' }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
          >
            {'→'}
          </button>
        </div>
      </div>
      <p
        className="px-6 text-xs font-medium tracking-wide mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        {headerText}
      </p>

      <div className="flex-1 overflow-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
            />
          </div>
        ) : tab === 'game' ? (
          <div className="max-w-2xl mx-auto space-y-2">
            {gameArticles.length === 0 && (
              <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                ゲーム記事がありません
              </p>
            )}
            {gameArticles.map((a) => (
              <GameArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : viewMode === 'day' ? (
          <ScheduleDayView date={dates[0]} entries={grouped.get(dateKey(dates[0])) ?? []} />
        ) : (
          <ScheduleGridView dates={dates} grouped={grouped} viewMode={viewMode} />
        )}
      </div>
    </div>
  );
};

const ToggleGroup: React.FC<{
  items: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  accent?: boolean;
}> = ({ items, active, onSelect, accent }) => (
  <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
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
