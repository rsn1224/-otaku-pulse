import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AiringEntry } from '../../types';
import { AiringCard } from '../schedule/AiringCard';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const getWeekStart = (offset: number): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  return monday;
};

const formatShortDate = (date: Date): string => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}`;
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
      const startTimestamp = Math.floor(weekStart.getTime() / 1000);
      const result = await invoke<AiringEntry[]>('get_airing_schedule', {
        startTimestamp,
        daysAhead: 7,
      });
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
  const grouped = useMemo(() => groupByDate(entries), [entries]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        return date;
      }),
    [weekStart],
  );

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Weekly Schedule
          </h1>
          <p
            className="text-xs font-medium tracking-wide mt-0.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            SEASONAL BROADCASTS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
          >
            {'←'}
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="px-3 h-8 text-xs rounded-lg hover:opacity-70 transition-opacity"
            style={{ background: 'var(--accent)', color: '#0e0e13', fontWeight: 600 }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
          >
            {'→'}
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-x-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
            />
          </div>
        ) : (
          <div className="flex gap-3 min-w-[900px] h-full">
            {weekDays.map((date) => {
              const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
              const dayEntries = grouped.get(key) ?? [];
              const isToday = new Date().toDateString() === date.toDateString();

              return (
                <div key={key} className="flex-1 min-w-[140px] flex flex-col">
                  <div
                    className="py-3 mb-3"
                    style={{
                      borderBottom: isToday
                        ? '2px solid var(--accent)'
                        : '1px solid rgba(72,71,77,0.1)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <h3
                        className="text-sm font-bold"
                        style={{ color: isToday ? 'var(--accent)' : 'var(--text-secondary)' }}
                      >
                        {DAY_LABELS[date.getDay()]}
                      </h3>
                      {isToday && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--accent)', color: '#0e0e13' }}
                        >
                          TODAY
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs font-bold uppercase tracking-tight mt-0.5"
                      style={{ color: isToday ? 'rgba(189,157,255,0.8)' : 'rgba(172,170,177,0.6)' }}
                    >
                      {formatShortDate(date)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {dayEntries.map((entry) => (
                      <AiringCard key={entry.id} entry={entry} />
                    ))}
                    {dayEntries.length === 0 && (
                      <p className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>
                        —
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
