import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { DiscoverArticleDto, DiscoverTab } from '../../types';
import { CardSkeletonGrid } from '../discover/CardSkeleton';
import { DiscoverCard } from '../discover/DiscoverCard';
import { HighlightsSection } from '../discover/HighlightsSection';

interface ArticleListProps {
  tab: DiscoverTab;
  filteredArticles: DiscoverArticleDto[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  focusedIndex: number;
  scrollPositions: Record<string, number>;
  clearError: () => void;
  loadMore: () => void;
  saveScrollPosition: (tab: string, pos: number) => void;
}

export const ArticleList: React.FC<ArticleListProps> = ({
  tab,
  filteredArticles,
  isLoading,
  hasMore,
  error,
  focusedIndex,
  scrollPositions,
  clearError,
  loadMore,
  saveScrollPosition,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // スクロール位置復元
  useEffect(() => {
    const pos = scrollPositions[tab];
    if (pos && scrollRef.current) {
      scrollRef.current.scrollTop = pos;
    }
  }, [tab, scrollPositions]);

  // スクロール位置保存
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const handleScroll = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => saveScrollPosition(tab, el.scrollTop), 150);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [tab, saveScrollPosition]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isLoading) {
        loadMore();
      }
    },
    [hasMore, isLoading, loadMore],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto discover-scroll">
      <div className="feed-column">
        {error && (
          <div className="rounded-lg p-3 mb-3 text-sm flex justify-between items-center bg-[var(--bg-card)] border border-[var(--badge-hot)] text-[var(--badge-hot)]">
            {error}
            <button type="button" onClick={clearError} className="ml-2 hover:opacity-80">
              ✕
            </button>
          </div>
        )}

        {/* Highlights: only on For You tab */}
        {tab === 'for_you' && <HighlightsSection />}

        {/* Card grid or skeleton */}
        {isLoading && filteredArticles.length === 0 ? (
          <CardSkeletonGrid />
        ) : (
          <div className="card-grid">
            {filteredArticles.map((article, i) => (
              <DiscoverCard
                key={article.id}
                article={article}
                featured={i === 0 && tab === 'for_you'}
                isFocused={i === focusedIndex}
              />
            ))}
          </div>
        )}

        {isLoading && filteredArticles.length > 0 && <Spinner />}

        {/* Empty state */}
        {!isLoading && filteredArticles.length === 0 && (
          <div className="text-center py-16 text-[var(--text-secondary)]">
            <p className="text-4xl mb-4">{'🔍'}</p>
            <p className="text-lg mb-2 text-[var(--text-primary)]">まだ記事がありません</p>
            <p className="text-sm mb-4">左下の「収集」ボタンで最新記事を取得しましょう</p>
          </div>
        )}

        {/* All caught up state */}
        {!isLoading &&
          !hasMore &&
          filteredArticles.length > 0 &&
          filteredArticles.every((a) => a.isRead) && (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <p className="text-2xl mb-2">{'✨'}</p>
              <p className="text-sm">全部読みました！ また来てね</p>
            </div>
          )}

        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  );
};

const Spinner: React.FC = () => (
  <div className="flex justify-center py-4">
    <div className="w-6 h-6 border-2 rounded-full animate-spin border-[var(--border)] border-t-[var(--accent)]" />
  </div>
);
