import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../../lib/logger';
import type { ArticleDto } from '../../types';

export const SavedWing: React.FC = () => {
  const [articles, setArticles] = useState<ArticleDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const initializedRef = useRef(false);

  const fetchBookmarks = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const result = await invoke<ArticleDto[]>('get_bookmarked_articles');
      setArticles(result);
    } catch (e) {
      logger.warn({ error: e }, 'fetchBookmarks failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchBookmarks();
    }
  }, [fetchBookmarks]);

  const handleUnbookmark = useCallback(async (id: number): Promise<void> => {
    try {
      await invoke('toggle_bookmark', { articleId: id });
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      logger.warn({ error: e }, 'toggle_bookmark failed');
    }
  }, []);

  const handleOpen = useCallback((url: string | null): void => {
    if (url) openUrl(url).catch((e) => logger.debug({ error: e }, 'openUrl failed'));
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      <div className="universal-tabs">
        <span className="tab-item active">
          Saved
          {articles.length > 0 && (
            <span className="ml-2 text-xs text-[var(--text-tertiary)]">{articles.length}件</span>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto discover-scroll">
        <div className="feed-column">
          {articles.map((a) => (
            <SavedCard key={a.id} article={a} onUnbookmark={handleUnbookmark} onOpen={handleOpen} />
          ))}

          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 rounded-full animate-spin border-[var(--border)] border-t-[var(--accent)]" />
            </div>
          )}

          {!isLoading && articles.length === 0 && (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              <p className="text-4xl mb-4">{'🔖'}</p>
              <p className="text-lg mb-2 text-[var(--text-primary)]">
                ブックマークした記事がここに表示されます
              </p>
              <p className="text-sm">Discover で気になる記事をブックマークしてみましょう</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SavedCard: React.FC<{
  article: ArticleDto;
  onUnbookmark: (id: number) => void;
  onOpen: (url: string | null) => void;
}> = ({ article, onUnbookmark, onOpen }) => (
  <div className="discover-card">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className="text-left font-semibold text-sm leading-snug hover:underline truncate block w-full text-[var(--text-primary)]"
          onClick={() => onOpen(article.url)}
        >
          {article.title}
        </button>
        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-tertiary)]">
          {article.feedName && <span>{article.feedName}</span>}
          {article.publishedAt && (
            <span>{new Date(article.publishedAt).toLocaleDateString('ja-JP')}</span>
          )}
        </div>
        {article.summary && (
          <p className="text-xs mt-2 line-clamp-2 text-[var(--text-secondary)]">
            {article.summary}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onUnbookmark(article.id)}
        title="ブックマーク解除"
        className="flex-shrink-0 p-1 rounded hover:opacity-70 text-[var(--accent)]"
      >
        <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>
    </div>
  </div>
);
