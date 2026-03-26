import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import type { AiringEntry } from '../../types';

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

export const AiringCard: React.FC<{ entry: AiringEntry }> = ({ entry }) => {
  const handleOpen = (): void => {
    if (entry.siteUrl) openUrl(entry.siteUrl).catch(() => {});
  };

  const episodeLabel = entry.totalEpisodes
    ? `#${entry.episode} / ${entry.totalEpisodes}`
    : `#${entry.episode}`;

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-center gap-3 p-2 rounded-lg w-full text-left hover:opacity-80 transition-opacity"
      style={{ background: 'var(--bg-card)' }}
    >
      {entry.coverImageUrl ? (
        <img
          src={entry.coverImageUrl}
          alt=""
          className="w-10 h-14 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-10 h-14 rounded flex-shrink-0 flex items-center justify-center text-lg"
          style={{ background: 'var(--bg-primary)' }}
        >
          {'📺'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {entry.titleNative ?? entry.titleRomaji}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          {episodeLabel}
        </p>
      </div>
      <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--accent)' }}>
        {formatTime(entry.airingAt)}
      </span>
    </button>
  );
};
