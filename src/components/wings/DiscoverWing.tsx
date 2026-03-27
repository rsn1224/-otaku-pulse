import type React from 'react';
import { useEffect, useMemo } from 'react';
import { applyMuteFilters } from '../../lib/articleFilter';
import { useArticleStore } from '../../stores/useArticleStore';
import { useFilterStore } from '../../stores/useFilterStore';
import { useKeyboardStore } from '../../stores/useKeyboardStore';
import { useReaderStore } from '../../stores/useReaderStore';
import { useSearchStore } from '../../stores/useSearchStore';
import { ArticleReader } from '../common/ArticleReader';
import { CitationFooter } from '../discover/CitationFooter';
import { DiscoverCard } from '../discover/DiscoverCard';
import { UniversalTabs } from '../discover/UniversalTabs';
import { ArticleList } from './ArticleList';

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
    scrollPositions,
    saveScrollPosition,
  } = useArticleStore();
  const { searchMode, searchResults, aiAnswer, aiCitations, isSearching } = useSearchStore();
  const { readerArticle, closeReader } = useReaderStore();
  const { focusedIndex } = useKeyboardStore();

  const { muteKeywords } = useFilterStore();
  const filteredArticles = useMemo(
    () => applyMuteFilters(articles, muteKeywords),
    [articles, muteKeywords],
  );

  useEffect(() => {
    fetchFeed(true);
    fetchHighlights();
  }, [fetchFeed, fetchHighlights]);

  // Search mode
  if (searchMode) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-primary)]">
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
                <div className="text-sm leading-[1.75] mt-2 text-[var(--text-primary)]">
                  {aiAnswer}
                </div>
                <CitationFooter citations={aiCitations} />
              </div>
            )}

            {!isSearching && searchResults.length === 0 && !aiAnswer && (
              <div className="text-center py-16 text-[var(--text-secondary)]">
                <p className="text-3xl mb-3">{'🔎'}</p>
                <p className="text-lg mb-2 text-[var(--text-primary)]">見つかりませんでした</p>
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
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      <UniversalTabs />

      <ArticleList
        tab={tab}
        filteredArticles={filteredArticles}
        isLoading={isLoading}
        hasMore={hasMore}
        error={error}
        focusedIndex={focusedIndex}
        scrollPositions={scrollPositions}
        clearError={clearError}
        loadMore={loadMore}
        saveScrollPosition={saveScrollPosition}
      />

      {/* Article Reader slide-over */}
      <ArticleReader article={readerArticle} onClose={closeReader} />
    </div>
  );
};

const Spinner: React.FC = () => (
  <div className="flex justify-center py-4">
    <div className="w-6 h-6 border-2 rounded-full animate-spin border-[var(--border)] border-t-[var(--accent)]" />
  </div>
);
