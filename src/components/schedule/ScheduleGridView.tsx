import type React from 'react';
import { DAY_LABELS, dateKey, fmtDate } from '../../lib/scheduleUtils';
import type { AiringEntry, ScheduleViewMode } from '../../types';
import { AiringCard } from './AiringCard';

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

      return (
        <div
          key={k}
          className={[
            viewMode === 'month'
              ? 'min-h-[80px] p-1 rounded overflow-hidden'
              : dayEntries.length > 0
                ? 'flex-1 min-w-[140px] flex flex-col'
                : 'w-[60px] flex-shrink-0 flex flex-col',
            viewMode === 'month' && isToday ? 'bg-[rgba(189,157,255,0.08)]' : '',
          ].join(' ')}
        >
          <div
            className={[
              viewMode === 'month' ? 'mb-1' : 'py-2 mb-2',
              viewMode === 'week' && isToday ? 'border-b-2 border-b-(--primary)' : '',
              viewMode === 'week' && !isToday ? 'border-b border-b-[rgba(72,71,77,0.1)]' : '',
            ].join(' ')}
          >
            {viewMode === 'week' && (
              <h3
                className={`text-xs font-bold ${isToday ? 'text-(--primary)' : 'text-(--on-surface-variant)'}`}
              >
                {DAY_LABELS[date.getDay()]}
              </h3>
            )}
            <p
              className={`text-[10px] font-bold ${isToday ? 'text-(--primary)' : 'text-(--outline)'}`}
            >
              {fmtDate(date)}
            </p>
          </div>
          <div className={viewMode === 'month' ? 'space-y-0.5' : 'flex flex-col gap-2'}>
            {dayEntries.map((e) =>
              viewMode === 'month' ? (
                <p
                  key={e.id}
                  className="text-[9px] truncate text-(--on-surface-variant)"
                  title={e.titleNative ?? e.titleRomaji}
                >
                  {e.titleNative ?? e.titleRomaji}
                </p>
              ) : (
                <AiringCard key={e.id} entry={e} />
              ),
            )}
            {viewMode === 'week' && dayEntries.length === 0 && (
              <p className="text-xs text-(--outline)">—</p>
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
    <h2 className="text-sm font-bold mb-3 text-(--primary)">
      {date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })}
      {' — '}
      {entries.length} 件
    </h2>
    {entries.map((e) => (
      <AiringCard key={e.id} entry={e} />
    ))}
    {entries.length === 0 && <p className="text-xs py-4 text-(--outline)">放送なし</p>}
  </div>
);
