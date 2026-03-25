import type React from 'react';

interface LoadMoreButtonProps {
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  isLoading,
  hasMore,
  onLoadMore,
}) => {
  if (!hasMore) {
    return <div className="text-center py-4 text-gray-400">これ以上の記事はありません</div>;
  }

  return (
    <div className="text-center py-4">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={isLoading}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>読み込み中...</span>
          </div>
        ) : (
          'さらに読み込む'
        )}
      </button>
    </div>
  );
};
