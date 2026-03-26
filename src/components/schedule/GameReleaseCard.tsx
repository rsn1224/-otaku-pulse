import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import type { GameReleaseEntry } from '../../types';

export const GameReleaseCard: React.FC<{ game: GameReleaseEntry }> = ({ game }) => {
  const handleOpen = (): void => {
    openUrl(`https://rawg.io/games/${game.slug}`).catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-start gap-2 p-1.5 rounded-lg w-full text-left hover:opacity-80 transition-opacity"
      style={{ background: 'var(--bg-card)' }}
    >
      {game.backgroundImage ? (
        <img
          src={game.backgroundImage}
          alt=""
          className="w-9 h-12 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-9 h-12 rounded flex-shrink-0 flex items-center justify-center text-sm"
          style={{ background: 'var(--bg-primary)' }}
        >
          {'🎮'}
        </div>
      )}
      <div className="flex-1 min-w-0 py-0.5">
        <p
          className="text-[11px] font-semibold leading-tight line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {game.name}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: '#699cff' }}>
          {game.platforms.slice(0, 3).join(', ')}
        </p>
      </div>
    </button>
  );
};
