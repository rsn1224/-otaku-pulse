import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import { useEffect, useState } from 'react';
import { containsHtml, sanitizeHtml, stripCitations } from '../../lib/textUtils';
import { useReaderStore } from '../../stores/useReaderStore';
import type { ArticleDetailDto, DiscoverArticleDto } from '../../types';
import { RelatedArticles } from './RelatedArticles';

interface ArticleReaderProps {
  article: ArticleDetailDto | null;
  onClose: () => void;
}

export const ArticleReader: React.FC<ArticleReaderProps> = ({ article, onClose }) => {
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [related, setRelated] = useState<DiscoverArticleDto[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const { openNextArticle, openPrevArticle } = useReaderStore();

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
            {/* Glass AI Summary */}
            {article.summary && (
              <div className="glass-summary rounded-2xl p-5 mb-6 relative overflow-hidden">
                <div className="flex items-center gap-1.5 mb-3">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: 'rgba(189, 157, 255, 0.1)',
                      border: '1px solid rgba(189, 157, 255, 0.2)',
                      color: 'var(--accent)',
                    }}
                  >
                    AI Summary
                  </span>
                </div>
                <p
                  className="text-[14px] leading-[1.6] italic"
                  style={{ color: 'rgba(249, 245, 253, 0.9)' }}
                >
                  {stripCitations(article.summary)}
                </p>
              </div>
            )}

            {article.content ? (
              containsHtml(article.content) ? (
                <div
                  className="text-sm leading-[1.85] article-html-content"
                  style={{ color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
                />
              ) : (
                <div
                  className="text-sm leading-[1.85] whitespace-pre-wrap"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {stripCitations(article.content)}
                </div>
              )
            ) : article.summary ? (
              <p className="text-sm leading-[1.85]" style={{ color: 'var(--text-primary)' }}>
                {stripCitations(article.summary)}
              </p>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>
                記事内容がありません。元記事をブラウザで開いてください。
              </p>
            )}

            <RelatedArticles articles={related} isLoading={relatedLoading} />
          </div>
        </div>
      </div>
    </div>
  );
};
