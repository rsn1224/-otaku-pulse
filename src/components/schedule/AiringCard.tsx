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

  const title = entry.titleNative ?? entry.titleRomaji;
  const ep = entry.totalEpisodes ? `#${entry.episode}/${entry.totalEpisodes}` : `#${entry.episode}`;

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-start gap-2 p-1.5 rounded-lg w-full text-left hover:opacity-80 transition-opacity bg-[var(--bg-card)]"
    >
      {entry.coverImageUrl ? (
        <img
          src={entry.coverImageUrl}
          alt=""
          className="w-9 h-12 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-9 h-12 rounded flex-shrink-0 flex items-center justify-center text-sm bg-[var(--bg-primary)]">
          {'📺'}
        </div>
      )}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-[11px] font-semibold leading-tight line-clamp-2 text-[var(--text-primary)]">
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-[var(--text-tertiary)]">{ep}</span>
          <span className="text-[10px] font-mono text-[var(--accent)]">
            {formatTime(entry.airingAt)}
          </span>
        </div>
      </div>
    </button>
  );
};
