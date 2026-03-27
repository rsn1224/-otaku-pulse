import type React from 'react';
import { DAY_LABELS, dateKey, fmtDate } from '../../lib/scheduleUtils';
import type { GameReleaseEntry, ScheduleViewMode } from '../../types';
import { GameReleaseCard } from './GameReleaseCard';

export const GameDayView: React.FC<{ date: Date; games: GameReleaseEntry[] }> = ({
  date,
  games,
}) => (
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

export const GameGridView: React.FC<{
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
          className={[
            viewMode === 'month'
              ? 'min-h-[80px] p-1 rounded overflow-hidden'
              : dayGames.length > 0
                ? 'flex-1 min-w-[140px] flex flex-col'
                : 'w-[60px] flex-shrink-0 flex flex-col',
            viewMode === 'month' && isToday ? 'bg-[rgba(105,156,255,0.08)]' : '',
          ].join(' ')}
        >
          <div
            className={[
              viewMode === 'month' ? 'mb-1' : 'py-2 mb-2',
              viewMode === 'week' && isToday ? 'border-b-2 border-b-[#699cff]' : '',
              viewMode === 'week' && !isToday ? 'border-b border-b-[rgba(72,71,77,0.1)]' : '',
            ].join(' ')}
          >
            {viewMode === 'week' && (
              <h3
                className={`text-xs font-bold ${isToday ? 'text-[#699cff]' : 'text-[var(--text-secondary)]'}`}
              >
                {DAY_LABELS[date.getDay()]}
              </h3>
            )}
            <p
              className={`text-[10px] font-bold ${isToday ? 'text-[#699cff]' : 'text-[var(--text-tertiary)]'}`}
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
