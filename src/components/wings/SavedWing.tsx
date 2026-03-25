import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { ArticleCard } from '../common/ArticleCard';

interface ArticleRow {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  category: string;
  published_at: string | null;
  is_read: boolean;
  thumbnail_url: string | null;
}

interface SavedWingState {
  articles: ArticleRow[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

export const SavedWing: React.FC = () => {
  const [state, setState] = useState<SavedWingState>({
    articles: [],
    isLoading: true,
    error: null,
    hasMore: false,
  });

  const fetchBookmarkedArticles = async () => {
    setState((prev: SavedWingState) => ({ ...prev, isLoading: true, error: null }));

    try {
      const articles = await invoke<ArticleRow[]>('get_bookmarked_articles');
      setState({
        articles,
        isLoading: false,
        error: null,
        hasMore: false,
      });
    } catch (error) {
      setState({
        articles: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bookmarked articles',
        hasMore: false,
      });
    }
  };

  const handleArticleClick = (id: number) => {
    // 記事を既読にする（必要に応じて）
    invoke('mark_read', { articleId: id });
  };

  const handleBookmarkToggle = async (id: number) => {
    try {
      await invoke('toggle_bookmark', { articleId: id });
      // ブックマーク解除後、リストを再取得
      await fetchBookmarkedArticles();
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  useEffect(() => {
    fetchBookmarkedArticles();
    // eslint-disable-next-line -- fetchBookmarkedArticles は安定参照ではないが初回のみ実行
  }, []);

  if (state.isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, index) => (
            <div key={`skeleton-${index}`} className="bg-gray-800 rounded-lg p-4">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
          <h3 className="text-red-400 font-medium">エラー</h3>
          <p className="text-red-300">{state.error}</p>
          <button
            type="button"
            onClick={fetchBookmarkedArticles}
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">SAVED</h1>
        <div className="text-gray-400">{state.articles.length} 件のブックマーク</div>
      </div>

      {state.articles.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-4">ブックマークした記事がここに表示されます</div>
          <div className="text-gray-500 text-sm">
            記事をブックマークすると、ここに保存されていつでも読み返せます
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {state.articles.map((article: ArticleRow, index: number) => (
            <div key={article.id} className="relative">
              <ArticleCard
                article={article}
                onRead={handleArticleClick}
                isFocused={false}
                index={index}
              />
              <button
                type="button"
                onClick={() => handleBookmarkToggle(article.id)}
                className="absolute top-4 right-4 p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                title="ブックマークを解除"
              >
                🔖
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
