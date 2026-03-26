import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyMuteFilters } from '../../lib/articleFilter';
import { useDiscoverStore } from '../../stores/useDiscoverStore';
import { ArticleReader } from '../common/ArticleReader';
import { CardSkeletonGrid } from '../discover/CardSkeleton';
import { CitationFooter } from '../discover/CitationFooter';
import { DiscoverCard } from '../discover/DiscoverCard';
import { HighlightsSection } from '../discover/HighlightsSection';
import { UniversalTabs } from '../discover/UniversalTabs';

export const DiscoverWing: React.FC = () => {
  const {
    tab,
    articles,
    isLoading,
    hasMore,
    error,
    fetchFeed,
    loadMore,
    clearError,
    fetchHighlights,
    searchMode,
    searchResults,
    aiAnswer,
    aiCitations,
    isSearching,
    readerArticle,
    closeReader,
    scrollPositions,
    saveScrollPosition,
    focusedIndex,
  } = useDiscoverStore();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // P5-C: キーワードフィルタ
  const [muteKeywords, setMuteKeywords] = useState<string[]>([]);
  useEffect(() => {
    invoke<{ keyword: string; filter_type: string }[]>('get_keyword_filters')
      .then((filters) =>
        setMuteKeywords(filters.filter((f) => f.filter_type === 'mute').map((f) => f.keyword)),
      )
      .catch(() => {});
  }, []);
  const filteredArticles = useMemo(
    () => applyMuteFilters(articles, muteKeywords),
    [articles, muteKeywords],
  );

  useEffect(() => {
    fetchFeed(true);
    fetchHighlights();
  }, [fetchFeed, fetchHighlights]);

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

  // Search mode
  if (searchMode) {
    return (
      <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        <UniversalTabs />
        <div className="flex-1 overflow-y-auto discover-scroll">
          <div className="feed-column">
            {isSearching && <Spinner />}

            {/* AI Answer */}
            {!isSearching && aiAnswer && (
              <div className="discover-card featured mb-4">
                <div className="ai-summary-label">
                  <svg
                    aria-hidden="true"
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  AI Answer
                </div>
                <div
                  className="text-sm leading-[1.75] mt-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {aiAnswer}
                </div>
                <CitationFooter citations={aiCitations} />
              </div>
            )}

            {!isSearching && searchResults.length === 0 && !aiAnswer && (
              <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
                <p className="text-3xl mb-3">{'🔎'}</p>
                <p className="text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                  見つかりませんでした
                </p>
                <p className="text-sm">別のキーワードで試してみてください</p>
              </div>
            )}
            {!isSearching && searchResults.length > 0 && (
              <>
                <p className="search-count">{searchResults.length}件の記事</p>
                <div className="card-grid">
                  {searchResults.map((a) => (
                    <DiscoverCard
                      key={a.id}
                      article={{
                        ...a,
                        feedId: a.feedId,
                        aiSummary: null,
                        totalScore: a.importanceScore,
                        category: null,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <ArticleReader article={readerArticle} onClose={closeReader} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <UniversalTabs />

      <div ref={scrollRef} className="flex-1 overflow-y-auto discover-scroll">
        <div className="feed-column">
          {error && (
            <div
              className="rounded-lg p-3 mb-3 text-sm flex justify-between items-center"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--badge-hot)',
                color: 'var(--badge-hot)',
              }}
            >
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
            <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
              <p className="text-4xl mb-4">{'🔍'}</p>
              <p className="text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                まだ記事がありません
              </p>
              <p className="text-sm mb-4">左下の「収集」ボタンで最新記事を取得しましょう</p>
            </div>
          )}

          {/* All caught up state */}
          {!isLoading &&
            !hasMore &&
            filteredArticles.length > 0 &&
            filteredArticles.every((a) => a.isRead) && (
              <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                <p className="text-2xl mb-2">{'✨'}</p>
                <p className="text-sm">全部読みました！ また来てね</p>
              </div>
            )}

          <div ref={sentinelRef} className="h-4" />
        </div>
      </div>

      {/* Article Reader slide-over */}
      <ArticleReader article={readerArticle} onClose={closeReader} />
    </div>
  );
};

const Spinner: React.FC = () => (
  <div className="flex justify-center py-4">
    <div
      className="w-6 h-6 border-2 rounded-full animate-spin"
      style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
    />
  </div>
);
