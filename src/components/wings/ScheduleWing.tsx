import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { AiringEntry } from '../../types';
import { AiringCard } from '../schedule/AiringCard';

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const formatDateHeader = (date: Date): string => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = DAY_LABELS[date.getDay()];
  return `${m}/${d} (${day})`;
};

const getWeekStart = (offset: number): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  return monday;
};

const groupByDate = (entries: AiringEntry[]): Map<string, AiringEntry[]> => {
  const map = new Map<string, AiringEntry[]>();
  for (const entry of entries) {
    const date = new Date(entry.airingAt * 1000);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
};

export const ScheduleWing: React.FC = () => {
  const [entries, setEntries] = useState<AiringEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const fetchSchedule = useCallback(async (offset: number): Promise<void> => {
    setIsLoading(true);
    try {
      const weekStart = getWeekStart(offset);
      const now = new Date();
      const startTimestamp = Math.floor(Math.max(weekStart.getTime(), now.getTime()) / 1000);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const daysAhead = Math.max(1, Math.ceil((weekEnd.getTime() / 1000 - startTimestamp) / 86400));

      const result = await invoke<AiringEntry[]>('get_airing_schedule', { daysAhead });
      setEntries(result);
    } catch (_) {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule(weekOffset);
  }, [weekOffset, fetchSchedule]);

  const weekStart = getWeekStart(weekOffset);
  const grouped = groupByDate(entries);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div className="universal-tabs">
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="px-2 py-1 rounded hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            {'←'}
          </button>
          <span className="tab-item active flex-1 text-center">{'📺'} 放送スケジュール</span>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="px-2 py-1 rounded hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            {'→'}
          </button>
          <button
            type="button"
            onClick={() => fetchSchedule(weekOffset)}
            className="px-2 py-1 rounded hover:opacity-70 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            更新
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto discover-scroll">
        <div className="feed-column">
          {isLoading && (
            <div className="flex justify-center py-8">
              <div
                className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
              />
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
              <p className="text-4xl mb-4">{'📺'}</p>
              <p className="text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                放送スケジュールがありません
              </p>
              <p className="text-sm">AniList から放送予定を取得します</p>
            </div>
          )}

          {!isLoading &&
            weekDays.map((date) => {
              const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
              const dayEntries = grouped.get(key) ?? [];
              const isToday = new Date().toDateString() === date.toDateString();

              return (
                <div key={key} className="mb-4">
                  <div
                    className="text-xs font-semibold px-1 py-2 sticky top-0 z-10"
                    style={{
                      color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
                      background: 'var(--bg-primary)',
                    }}
                  >
                    {formatDateHeader(date)}
                    {isToday && ' — 今日'}
                    {dayEntries.length > 0 && (
                      <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>
                        {dayEntries.length}件
                      </span>
                    )}
                  </div>
                  {dayEntries.length > 0 ? (
                    <div className="space-y-1">
                      {dayEntries.map((entry) => (
                        <AiringCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs px-1 py-2" style={{ color: 'var(--text-tertiary)' }}>
                      放送なし
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
