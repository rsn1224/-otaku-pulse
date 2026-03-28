import type React from 'react';
import { cn } from '../../lib/utils';
import type { DiscoverArticleDto } from '../../types';

const CATEGORY_LABELS: Record<string, string> = {
  anime: 'アニメ',
  manga: '漫画',
  game: 'ゲーム',
  pc: 'ハード',
};

export const formatRelativeTime = (publishedAt: string | null): string => {
  if (!publishedAt) return '';
  const date = new Date(publishedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const rtf = new Intl.RelativeTimeFormat('ja', { numeric: 'auto' });

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return rtf.format(-diffMinutes, 'minute');
  }
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  return rtf.format(-Math.floor(diffHours / 24), 'day');
};

export const estimateReadTime = (text: string | null): string | null => {
  if (!text) return null;
  return `${Math.max(1, Math.ceil(text.length / 500))}分`;
};

interface CardHeaderProps {
  article: DiscoverArticleDto;
  onBookmark: () => void;
  bookmarkAnimClass?: string;
}

export function CardHeader({
  article,
  onBookmark,
  bookmarkAnimClass,
}: CardHeaderProps): React.JSX.Element {
  const catLabel = article.category
    ? (CATEGORY_LABELS[article.category] ?? article.category)
    : null;
  const readTime = estimateReadTime(article.summary);

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-0 text-xs text-(--on-surface-variant)">
        <span className="font-medium">{article.feedName ?? 'Unknown'}</span>
        <span className="meta-dot">{formatRelativeTime(article.publishedAt)}</span>
        {catLabel && <span className="source-badge cat-badge ml-2">{catLabel}</span>}
        {readTime && <span className="meta-dot">{readTime}</span>}
      </div>

      <button
        type="button"
        onClick={onBookmark}
        className={cn('bookmark-btn', bookmarkAnimClass)}
        title="ブックマーク"
        aria-label={article.isBookmarked ? 'ブックマーク解除' : 'ブックマークに追加'}
      >
        <svg
          aria-hidden="true"
          className="w-4 h-4"
          fill={article.isBookmarked ? 'var(--primary)' : 'none'}
          stroke={article.isBookmarked ? 'var(--primary)' : 'var(--outline)'}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      </button>
    </div>
  );
}
