import type React from 'react';
import type { ArticleDto } from '../../types';

interface ArticleListProps {
  articles: ArticleDto[];
  isLoading: boolean;
  onArticleClick: (article: ArticleDto) => void;
  onMarkAsRead: (articleId: number) => void;
  onToggleBookmark: (articleId: number) => void;
}

export const ArticleList: React.FC<ArticleListProps> = ({
  articles,
  isLoading,
  onArticleClick,
  onMarkAsRead,
  onToggleBookmark,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, index) => (
          <div key={`skeleton-${index}`} className="bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-lg">記事がありません</div>
        <div className="text-gray-500 text-sm mt-2">
          設定からフィードを追加して、データ収集を実行してください
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <div
          key={article.id}
          className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => onArticleClick(article)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onArticleClick(article);
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-4">
              <h3
                className={`text-lg font-medium mb-2 ${
                  article.isRead ? 'text-gray-400' : 'text-gray-100'
                }`}
              >
                {article.title}
              </h3>

              <div className="flex items-center space-x-4 text-sm text-gray-400 mb-2">
                <span>{article.feedName}</span>
                <span>•</span>
                <span>
                  {article.publishedAt
                    ? new Date(article.publishedAt).toLocaleDateString('ja-JP')
                    : ''}
                </span>
              </div>

              <p className="text-gray-300 text-sm line-clamp-2 mb-3">{article.summary}</p>
            </div>

            <div className="flex flex-col space-y-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(article.id);
                }}
                className={`p-2 rounded ${
                  article.isBookmarked
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title={article.isBookmarked ? 'ブックマークを外す' : 'ブックマークする'}
              >
                {article.isBookmarked ? '🔖' : '📑'}
              </button>

              {!article.isRead && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(article.id);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  既読
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
