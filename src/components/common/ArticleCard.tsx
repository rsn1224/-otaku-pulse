import { openUrl } from '@tauri-apps/plugin-opener';
import React from 'react';
import { getHighlightSegments } from '../../lib/highlightText';
import { useArticleStore } from '../../stores/useArticleStore';

interface ArticleRow {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  category: string;
  published_at: string | null;
  is_read: boolean;
  thumbnail_url: string | null;
}

interface ArticleCardProps {
  article: ArticleRow;
  onRead: (id: number) => void;
  isFocused?: boolean;
  index?: number;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'anime':
      return '🎌';
    case 'game':
      return '🎮';
    case 'manga':
      return '📖';
    case 'pc':
      return '💻';
    default:
      return '📰';
  }
};

const formatRelativeTime = (publishedAt: string | null) => {
  if (!publishedAt) return '';

  const date = new Date(publishedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  const rtf = new Intl.RelativeTimeFormat('ja', { numeric: 'auto' });

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return rtf.format(-diffMinutes, 'minute');
  } else if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour');
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return rtf.format(-diffDays, 'day');
  }
};

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  onRead,
  isFocused = false,
  index,
}) => {
  const { getArticleHighlights } = useArticleStore();

  const highlights = getArticleHighlights(article);

  const truncatedSummary = article.summary
    ? article.summary.length > 80
      ? `${article.summary.substring(0, 80)}...`
      : article.summary
    : '';

  const handleClick = () => {
    openUrl(article.url);
    onRead(article.id);
  };

  // フォーカス時に自動スクロール
  React.useEffect(() => {
    if (isFocused && index !== undefined) {
      const element = document.getElementById(`article-${index}`);
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused, index]);

  return (
    <div
      id={index !== undefined ? `article-${index}` : undefined}
      className={`bg-white dark:bg-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer ${
        article.is_read ? 'opacity-60' : ''
      } ${isFocused ? 'ring-2 ring-blue-500' : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
    >
      <div className="flex space-x-4">
        <div className="flex-shrink-0 w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
          {article.thumbnail_url ? (
            <img
              src={article.thumbnail_url}
              alt={article.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">
              {getCategoryIcon(article.category)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h3
              className={`font-medium text-gray-900 dark:text-gray-100 truncate ${
                article.is_read ? 'text-gray-500 dark:text-gray-400' : ''
              }`}
            >
              {highlights.length > 0
                ? getHighlightSegments(article.title, highlights).map((seg, i) =>
                    seg.isHighlighted ? (
                      <mark key={`t-${i}`} className="bg-yellow-300 text-gray-900 px-0.5 rounded">
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={`t-${i}`}>{seg.text}</span>
                    ),
                  )
                : article.title}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
              {article.source}
            </span>
          </div>

          {truncatedSummary && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
              {highlights.length > 0
                ? getHighlightSegments(truncatedSummary, highlights).map((seg, i) =>
                    seg.isHighlighted ? (
                      <mark key={`s-${i}`} className="bg-yellow-300 text-gray-900 px-0.5 rounded">
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={`s-${i}`}>{seg.text}</span>
                    ),
                  )
                : truncatedSummary}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatRelativeTime(article.published_at)}</span>
              {!article.is_read && (
                <span className="px-2 py-1 bg-blue-600 text-white rounded-full">未読</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
