import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import type { DiscoverArticleDto } from '../../types';

interface RelatedArticlesProps {
  articles: DiscoverArticleDto[];
  isLoading: boolean;
}

export const RelatedArticles: React.FC<RelatedArticlesProps> = ({ articles, isLoading }) => {
  if (isLoading) {
    return (
      <div className="mt-8 pt-6 border-t border-(--surface-container-highest)">
        <div className="skeleton-line h-3 w-16 mb-3" />
        <div className="space-y-2">
          <div className="skeleton-line h-12 w-full rounded-lg" />
          <div className="skeleton-line h-12 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (articles.length === 0) return null;

  return (
    <div className="mt-8 pt-6 border-t border-(--surface-container-highest)">
      <h3 className="text-xs font-semibold uppercase mb-3 text-(--outline) tracking-[0.04em]">
        Related
      </h3>
      <div className="space-y-2">
        {articles.map((r) => (
          <button
            key={r.id}
            type="button"
            className="w-full text-left p-3 rounded-lg transition-colors border-l-2 border-l-(--primary) bg-(--surface-container) hover:bg-(--surface-container-high)"
            onClick={() => r.url && openUrl(r.url)}
          >
            <p className="text-sm font-medium text-(--on-surface)">{r.title}</p>
            <p className="text-xs mt-1 text-(--outline)">{r.feedName}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
