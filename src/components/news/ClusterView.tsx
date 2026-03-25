import type React from 'react';
import { useMemo, useState } from 'react';
import { type ArticleCluster, clusterArticles } from '../../lib/articleClustering';
import { useArticleStore } from '../../stores/useArticleStore';
import { ArticleCard } from '../common/ArticleCard';

interface ClusterViewProps {
  onRead: (id: number) => void;
}

export const ClusterView: React.FC<ClusterViewProps> = ({ onRead }) => {
  const { filteredArticles } = useArticleStore();
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  // クラスタリングをメモ化
  const clusterResult = useMemo(() => {
    return clusterArticles(filteredArticles);
  }, [filteredArticles]);

  const toggleCluster = (topic: string) => {
    setExpandedClusters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(topic)) {
        newSet.delete(topic);
      } else {
        newSet.add(topic);
      }
      return newSet;
    });
  };

  const renderCluster = (cluster: ArticleCluster) => {
    const isExpanded = expandedClusters.has(cluster.topic);
    const additionalCount = cluster.articles.length - 1;

    return (
      <div key={cluster.topic} className="mb-6">
        {/* クラスターヘッダー */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {cluster.topic}
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {cluster.articles.length} 件
            </span>
          </div>

          {/* 代表記事 */}
          <ArticleCard article={cluster.representativeArticle} onRead={onRead} isFocused={false} />

          {/* 展開ボタン */}
          {additionalCount > 0 && (
            <button
              type="button"
              onClick={() => toggleCluster(cluster.topic)}
              className="mt-3 flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <svg
                aria-hidden="true"
                className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              <span>{isExpanded ? '▲ 折りたたむ' : `▼ 他 ${additionalCount} 件`}</span>
            </button>
          )}
        </div>

        {/* 展開された記事 */}
        {isExpanded && additionalCount > 0 && (
          <div className="mt-2 space-y-2 ml-4">
            {cluster.articles.slice(1).map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                onRead={onRead}
                isFocused={false}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* クラスター */}
      {clusterResult.clusters.map(renderCluster)}

      {/* スタンドアロン記事 */}
      {clusterResult.standalone.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            その他の記事
          </h3>
          <div className="space-y-2">
            {clusterResult.standalone.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                onRead={onRead}
                isFocused={false}
                index={index}
              />
            ))}
          </div>
        </div>
      )}

      {/* 空状態 */}
      {clusterResult.clusters.length === 0 && clusterResult.standalone.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">記事がありません</div>
      )}
    </div>
  );
};
