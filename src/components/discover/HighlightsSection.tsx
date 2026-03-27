import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import { useArticleStore } from '../../stores/useArticleStore';

export const HighlightsSection: React.FC = () => {
  const { highlights, highlightsLoading } = useArticleStore();

  if (highlightsLoading) {
    return (
      <div className="highlights-section">
        <div className="highlights-header">
          <span className="highlights-icon" />
          Today&apos;s Highlights
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-line h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (highlights.length === 0) return null;

  return (
    <div className="highlights-section">
      <div className="highlights-header">
        <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        Today&apos;s Highlights
      </div>
      <div className="highlights-grid">
        {highlights.map((h) => (
          <button
            key={h.article.id}
            type="button"
            className="highlight-card"
            onClick={() => {
              if (h.article.url) openUrl(h.article.url);
            }}
          >
            <span className="highlight-reason">{h.reason}</span>
            <span className="highlight-title">{h.article.title}</span>
            <span className="highlight-meta">{h.article.feedName}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
