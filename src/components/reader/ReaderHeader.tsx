import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import { useState } from 'react';
import type { ArticleDetailDto } from '../../types';

interface ReaderHeaderProps {
  article: ArticleDetailDto;
  onClose: () => void;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({ article, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = (): void => {
    if (article.url) {
      navigator.clipboard.writeText(article.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="bookmark-btn flex-shrink-0"
            title="閉じる"
          >
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold truncate text-[var(--text-primary)]">
            {article.title}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <button
            type="button"
            onClick={handleCopyLink}
            className="card-action-btn secondary"
            title="リンクをコピー"
          >
            {copied ? '✓ コピー済' : 'コピー'}
          </button>
          <button
            type="button"
            onClick={() => article.url && openUrl(article.url)}
            disabled={!article.url}
            className="card-action-btn primary"
            style={!article.url ? { opacity: 0.3 } : undefined}
          >
            元記事
          </button>
        </div>
      </div>

      <div className="px-6 py-2 flex-shrink-0 border-b border-[var(--border)]">
        <div className="flex flex-wrap gap-3 text-xs text-[var(--text-source)]">
          {article.feedName && <span className="source-badge">{article.feedName}</span>}
          {article.publishedAt && (
            <span>{new Date(article.publishedAt).toLocaleDateString('ja-JP')}</span>
          )}
          {article.author && <span>{article.author}</span>}
        </div>
      </div>
    </>
  );
};
