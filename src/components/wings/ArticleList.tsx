import { motion } from 'motion/react';
import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { staggerContainer, staggerItem } from '../../lib/motion-variants';
import type { DiscoverArticleDto, DiscoverTab } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { CardSkeletonGrid } from '../discover/CardSkeleton';
import { DiscoverCard } from '../discover/DiscoverCard';
import { HighlightsSection } from '../discover/HighlightsSection';
import { Spinner } from '../ui/Spinner';

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

export function ArticleList({
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
}: ArticleListProps): React.JSX.Element {
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
      if (target?.isIntersecting && hasMore && !isLoading) {
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
          <div className="rounded-lg p-3 mb-3 text-sm flex justify-between items-center bg-(--surface-container) border border-(--error) text-(--error)">
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
          <motion.div
            className="card-grid"
            role="feed"
            aria-label="Article feed"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {filteredArticles.map((article, i) => (
              <motion.div key={article.id} variants={staggerItem}>
                <DiscoverCard
                  article={article}
                  featured={i === 0 && tab === 'for_you'}
                  isFocused={i === focusedIndex}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {isLoading && filteredArticles.length > 0 && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredArticles.length === 0 && <EmptyState variant="no-articles" />}

        {/* All caught up state */}
        {!isLoading &&
          !hasMore &&
          filteredArticles.length > 0 &&
          filteredArticles.every((a) => a.isRead) && (
            <div className="text-center py-8 text-(--on-surface-variant)">
              <p className="text-2xl mb-2">{'✨'}</p>
              <p className="text-sm">全部読みました！ また来てね</p>
            </div>
          )}

        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  );
}
