import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import type { DiscoverArticleDto } from '../../types';

const formatDate = (publishedAt: string | null): string => {
  if (!publishedAt) return '';
  return new Date(publishedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
};

export const GameArticleCard: React.FC<{ article: DiscoverArticleDto }> = ({ article }) => {
  const handleOpen = (): void => {
    if (article.url) openUrl(article.url).catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-center gap-3 p-3 rounded-xl w-full text-left hover:opacity-80 transition-opacity"
      style={{ background: 'var(--bg-card)' }}
    >
      {article.thumbnailUrl ? (
        <img
          src={article.thumbnailUrl}
          alt=""
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-lg"
          style={{ background: 'var(--bg-primary)' }}
        >
          {'🎮'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {article.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {article.feedName && (
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {article.feedName}
            </span>
          )}
          <span className="text-[10px]" style={{ color: '#699cff' }}>
            {formatDate(article.publishedAt)}
          </span>
        </div>
      </div>
    </button>
  );
};
