import type React from 'react';
import { useArticleStore } from '../../stores/useArticleStore';

export const ViewToggle: React.FC = () => {
  const { viewMode, setViewMode } = useArticleStore();

  return (
    <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button
        type="button"
        onClick={() => setViewMode('list')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          viewMode === 'list'
            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        リスト
      </button>
      <button
        type="button"
        onClick={() => setViewMode('cluster')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          viewMode === 'cluster'
            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        クラスター
      </button>
    </div>
  );
};
