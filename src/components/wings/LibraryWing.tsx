import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../../lib/logger';
import type { DiscoverArticleDto, DiscoverFeedResult } from '../../types';
import { DiscoverCard } from '../discover/DiscoverCard';

export const LibraryWing: React.FC = () => {
  const [articles, setArticles] = useState<DiscoverArticleDto[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const offsetRef = useRef(0);
  const initializedRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadingRef = useRef(false);

  const fetchLibrary = useCallback(async (reset: boolean): Promise<void> => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    const newOffset = reset ? 0 : offsetRef.current;
    try {
      const result = await invoke<DiscoverFeedResult>('get_library_articles', {
        limit: 30,
        offset: newOffset,
      });
      setArticles((prev) => (reset ? result.articles : [...prev, ...result.articles]));
      setHasMore(result.hasMore);
      offsetRef.current = newOffset + result.articles.length;
    } catch (e) {
      logger.warn({ error: e }, 'fetchLibrary failed');
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // 初回ロードのみ
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchLibrary(true);
    }
  }, [fetchLibrary]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasMore && !isLoading) {
          fetchLibrary(false);
        }
      },
      { threshold: 0.1 },
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, fetchLibrary]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      <div className="universal-tabs">
        <span className="tab-item active">
          ブックマーク
          {articles.length > 0 && (
            <span className="ml-2 text-xs text-[var(--text-tertiary)]">{articles.length}件</span>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto discover-scroll">
        <div className="feed-column">
          <div className="card-grid">
            {articles.map((article) => (
              <DiscoverCard key={article.id} article={article} />
            ))}
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 rounded-full animate-spin border-[var(--border)] border-t-[var(--accent)]" />
            </div>
          )}

          {!isLoading && articles.length === 0 && (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              <p className="text-4xl mb-4">{'📚'}</p>
              <p className="text-lg mb-2 text-[var(--text-primary)]">ブックマークがありません</p>
              <p className="text-sm">Discover で気になる記事をブックマークしてみましょう</p>
            </div>
          )}

          <div ref={sentinelRef} className="h-4" />
        </div>
      </div>
    </div>
  );
};
