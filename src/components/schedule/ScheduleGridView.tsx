import type React from 'react';
import type { AiringEntry, ScheduleViewMode } from '../../types';
import { AiringCard } from './AiringCard';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const dateKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const fmtDate = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()}`;

interface Props {
  dates: Date[];
  grouped: Map<string, AiringEntry[]>;
  viewMode: ScheduleViewMode;
}

export const ScheduleGridView: React.FC<Props> = ({ dates, grouped, viewMode }) => (
  <div className={viewMode === 'month' ? 'grid grid-cols-7 gap-1' : 'flex gap-3 min-w-[900px]'}>
    {dates.map((date) => {
      const k = dateKey(date);
      const dayEntries = grouped.get(k) ?? [];
      const isToday = new Date().toDateString() === date.toDateString();
      const accent = isToday ? 'var(--accent)' : 'var(--text-secondary)';

      return (
        <div
          key={k}
          className={
            viewMode === 'month'
              ? 'min-h-[80px] p-1 rounded overflow-hidden'
              : dayEntries.length > 0
                ? 'flex-1 min-w-[140px] flex flex-col'
                : 'w-[60px] flex-shrink-0 flex flex-col'
          }
          style={
            viewMode === 'month'
              ? { background: isToday ? 'rgba(189,157,255,0.08)' : 'transparent' }
              : undefined
          }
        >
          <div
            className={viewMode === 'month' ? 'mb-1' : 'py-2 mb-2'}
            style={
              viewMode === 'week'
                ? {
                    borderBottom: isToday
                      ? '2px solid var(--accent)'
                      : '1px solid rgba(72,71,77,0.1)',
                  }
                : undefined
            }
          >
            {viewMode === 'week' && (
              <h3 className="text-xs font-bold" style={{ color: accent }}>
                {DAY_LABELS[date.getDay()]}
              </h3>
            )}
            <p
              className="text-[10px] font-bold"
              style={{ color: isToday ? 'var(--accent)' : 'var(--text-tertiary)' }}
            >
              {fmtDate(date)}
            </p>
          </div>
          <div className={viewMode === 'month' ? 'space-y-0.5' : 'flex flex-col gap-2'}>
            {dayEntries.map((e) =>
              viewMode === 'month' ? (
                <p
                  key={e.id}
                  className="text-[9px] truncate text-[var(--text-secondary)]"
                  title={e.titleNative ?? e.titleRomaji}
                >
                  {e.titleNative ?? e.titleRomaji}
                </p>
              ) : (
                <AiringCard key={e.id} entry={e} />
              ),
            )}
            {viewMode === 'week' && dayEntries.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)]">—</p>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

export const ScheduleDayView: React.FC<{ date: Date; entries: AiringEntry[] }> = ({
  date,
  entries,
}) => (
  <div className="max-w-lg mx-auto space-y-2">
    <h2 className="text-sm font-bold mb-3 text-[var(--accent)]">
      {date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })}
      {' — '}
      {entries.length} 件
    </h2>
    {entries.map((e) => (
      <AiringCard key={e.id} entry={e} />
    ))}
    {entries.length === 0 && <p className="text-xs py-4 text-[var(--text-tertiary)]">放送なし</p>}
  </div>
);
