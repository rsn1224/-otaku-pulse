import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import { useEffect, useState } from 'react';
import { stripCitations } from '../../lib/textUtils';
import { useDiscoverStore } from '../../stores/useDiscoverStore';
import type { ArticleDetailDto, DiscoverArticleDto } from '../../types';

interface ArticleReaderProps {
  article: ArticleDetailDto | null;
  onClose: () => void;
}

export const ArticleReader: React.FC<ArticleReaderProps> = ({ article, onClose }) => {
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [related, setRelated] = useState<DiscoverArticleDto[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const { openNextArticle, openPrevArticle } = useDiscoverStore();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight') openNextArticle();
      if (e.key === 'ArrowLeft') openPrevArticle();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openNextArticle, openPrevArticle]);

  // 関連記事を取得（race condition 防止）
  useEffect(() => {
    if (!article) return;
    let stale = false;
    setRelated([]);
    setRelatedLoading(true);
    invoke<DiscoverArticleDto[]>('get_related_articles', { articleId: article.id })
      .then((r) => {
        if (!stale) setRelated(r);
      })
      .catch(() => {
        if (!stale) setRelated([]);
      })
      .finally(() => {
        if (!stale) setRelatedLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [article]);

  const handleClose = (): void => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  const handleCopyLink = (): void => {
    if (article?.url) {
      navigator.clipboard.writeText(article.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!article) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        role="presentation"
        onClick={handleClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose();
        }}
      />

      <div
        className="fixed right-0 top-0 h-full w-3/5 min-w-[480px] overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-primary)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 40px rgba(0, 0, 0, 0.4)',
          animation: closing
            ? 'slideOutRight 0.2s ease-in forwards'
            : 'slideInRight 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={handleClose}
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
            <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
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

        {/* Meta */}
        <div
          className="px-6 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-source)' }}>
            {article.feedName && <span className="source-badge">{article.feedName}</span>}
            {article.publishedAt && (
              <span>{new Date(article.publishedAt).toLocaleDateString('ja-JP')}</span>
            )}
            {article.author && <span>{article.author}</span>}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto discover-scroll px-6 py-6">
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            {article.content ? (
              <div
                className="text-sm leading-[1.85] whitespace-pre-wrap"
                style={{ color: 'var(--text-primary)' }}
              >
                {stripCitations(article.content)}
              </div>
            ) : article.summary ? (
              <p className="text-sm leading-[1.85]" style={{ color: 'var(--text-primary)' }}>
                {stripCitations(article.summary)}
              </p>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>
                記事内容がありません。元記事をブラウザで開いてください。
              </p>
            )}

            {/* 関連記事 */}
            {relatedLoading && (
              <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="skeleton-line h-3 w-16 mb-3" />
                <div className="space-y-2">
                  <div className="skeleton-line h-12 w-full rounded-lg" />
                  <div className="skeleton-line h-12 w-full rounded-lg" />
                </div>
              </div>
            )}
            {!relatedLoading && related.length > 0 && (
              <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
                <h3
                  className="text-xs font-semibold uppercase mb-3"
                  style={{ color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}
                >
                  Related
                </h3>
                <div className="space-y-2">
                  {related.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="w-full text-left p-3 rounded-lg transition-colors"
                      style={{
                        background: 'var(--bg-card)',
                        borderLeft: '2px solid var(--accent)',
                      }}
                      onClick={() => r.url && openUrl(r.url)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
                      }}
                    >
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {r.title}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {r.feedName}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
