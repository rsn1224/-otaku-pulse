import { useEffect } from 'react';
import { useArticleStore } from '../../stores/useArticleStore';
import { ArticleCard } from '../common/ArticleCard';
import { CategoryTabs } from '../common/CategoryTabs';
import { FilterControls } from '../common/FilterControls';
import { LoadMoreButton } from '../common/LoadMoreButton';
import { ClusterView } from '../news/ClusterView';
import { ViewToggle } from '../news/ViewToggle';

export const NewsWing: React.FC = () => {
  const {
    articles,
    isLoading,
    error,
    category,
    unreadOnly,
    viewMode,
    fetchArticles,
    loadMore,
    markRead,
    markAllRead,
    setCategory,
    setUnreadOnly,
    clearError,
    hasMore,
    focusedIndex,
    filteredArticles,
    fetchKeywordFilters,
  } = useArticleStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: 初回マウント時のみ実行
  useEffect(() => {
    fetchArticles(true);
    fetchKeywordFilters();
  }, []);

  const handleCategoryChange = (newCategory: string | null) => {
    setCategory(newCategory);
  };

  const handleUnreadOnlyChange = (value: boolean) => {
    setUnreadOnly(value);
  };

  const handleArticleClick = (id: number) => {
    markRead(id);
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
          <h3 className="text-red-400 font-medium">エラー</h3>
          <p className="text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => {
              clearError();
              fetchArticles(true);
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">NEWS</h1>
        <ViewToggle />
      </div>

      <CategoryTabs selectedCategory={category} onCategoryChange={handleCategoryChange} />

      <FilterControls
        unreadOnly={unreadOnly}
        onUnreadOnlyChange={handleUnreadOnlyChange}
        onMarkAllRead={markAllRead}
      />

      {viewMode === 'cluster' ? (
        <ClusterView onRead={handleArticleClick} />
      ) : (
        <div className="space-y-4">
          {filteredArticles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              onRead={handleArticleClick}
              isFocused={focusedIndex === index}
              index={index}
            />
          ))}
        </div>
      )}

      {articles.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">記事がありません</p>
        </div>
      )}

      {hasMore && !isLoading && (
        <LoadMoreButton onLoadMore={loadMore} isLoading={isLoading} hasMore={hasMore} />
      )}
    </div>
  );
};
