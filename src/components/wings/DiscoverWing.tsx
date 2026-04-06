import { AnimatePresence } from 'motion/react';
import type React from 'react';
import { useEffect } from 'react';
import { useAnnounce } from '../../hooks/useAnnouncer';
import { useArticleStore } from '../../stores/useArticleStore';
import { useKeyboardStore } from '../../stores/useKeyboardStore';
import { useReaderStore } from '../../stores/useReaderStore';
import { useSchedulerStore } from '../../stores/useSchedulerStore';
import { useSearchStore } from '../../stores/useSearchStore';
import { ArticleReader } from '../common/ArticleReader';
import { EmptyState } from '../common/EmptyState';
import { CitationFooter } from '../discover/CitationFooter';
import { DiscoverCard } from '../discover/DiscoverCard';
import { TopicClusterCard } from '../discover/TopicClusterCard';
import { UniversalTabs } from '../discover/UniversalTabs';
import { Spinner } from '../ui/Spinner';
import { ArticleList } from './ArticleList';

export function DiscoverWing(): React.JSX.Element {
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
    scrollPositions,
    saveScrollPosition,
    displayMode,
    clusters,
    clustersLoading,
    setDisplayMode,
  } = useArticleStore();
  const { searchMode, searchResults, aiAnswer, aiCitations, isSearching } = useSearchStore();
  const { readerArticle, closeReader } = useReaderStore();
  const { isOffline } = useSchedulerStore();
  const { focusedIndex } = useKeyboardStore();
  const { announce } = useAnnounce();

  useEffect(() => {
    fetchFeed(true);
    fetchHighlights();
  }, [fetchFeed, fetchHighlights]);

  // 検索完了時にスクリーンリーダーへ結果件数をアナウンス
  useEffect(() => {
    if (!isSearching && searchMode && searchResults.length > 0) {
      announce(`${searchResults.length}件の記事が見つかりました`);
    }
  }, [isSearching, searchMode, searchResults.length, announce]);

  // Search mode
  if (searchMode) {
    return (
      <div className="h-full flex flex-col bg-(--surface)">
        <UniversalTabs />
        <div className="flex-1 overflow-y-auto discover-scroll">
          <div className="feed-column">
            {isSearching && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}

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
                <div className="text-sm leading-[1.75] mt-2 text-(--on-surface)">{aiAnswer}</div>
                <CitationFooter citations={aiCitations} />
              </div>
            )}

            {!isSearching && searchResults.length === 0 && !aiAnswer && (
              <EmptyState variant="no-results" />
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
                        impactLevel: null,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <AnimatePresence>
          {readerArticle && <ArticleReader article={readerArticle} onClose={closeReader} />}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-(--surface)">
      <UniversalTabs />

      {isOffline && (
        <div className="bg-amber-900/50 text-amber-200 px-4 py-2 text-sm text-center shrink-0">
          Network unavailable — showing cached articles
        </div>
      )}

      {/* クラスタ/フラット切り替えボタン */}
      <div className="flex justify-end px-4 py-1 shrink-0">
        <button
          type="button"
          className={`text-xs px-2 py-0.5 rounded transition-colors ${displayMode === 'cluster' ? 'bg-(--primary-soft) text-(--primary)' : 'text-(--on-surface-variant) hover:text-(--on-surface)'}`}
          onClick={() => setDisplayMode(displayMode === 'cluster' ? 'flat' : 'cluster')}
        >
          {displayMode === 'cluster' ? '● クラスタ表示中' : '○ クラスタ表示'}
        </button>
      </div>

      {displayMode === 'cluster' ? (
        <div className="flex-1 overflow-y-auto discover-scroll">
          <div className="feed-column">
            {clustersLoading && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
            {!clustersLoading && clusters.length === 0 && (
              <EmptyState variant="no-results" />
            )}
            {!clustersLoading && clusters.map((group) => (
              <TopicClusterCard key={group.clusterId} group={group} />
            ))}
          </div>
        </div>
      ) : (
        <ArticleList
          tab={tab}
          filteredArticles={articles}
          isLoading={isLoading}
          hasMore={hasMore}
          error={error}
          focusedIndex={focusedIndex}
          scrollPositions={scrollPositions}
          clearError={clearError}
          loadMore={loadMore}
          saveScrollPosition={saveScrollPosition}
        />
      )}

      {/* Article Reader slide-over */}
      <AnimatePresence>
        {readerArticle && <ArticleReader article={readerArticle} onClose={closeReader} />}
      </AnimatePresence>
    </div>
  );
}
