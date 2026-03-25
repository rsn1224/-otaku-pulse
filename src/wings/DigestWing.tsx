import { useEffect } from 'react';
import { DigestCard } from '../components/digest/DigestCard';
import { DigestSkeleton } from '../components/digest/DigestSkeleton';
import { useDigestStore } from '../stores/useDigestStore';

const categories = ['all', 'anime', 'manga', 'game', 'pc'];

export const DigestWing: React.FC = () => {
  const { digests, isGenerating, error, generateDigest, clearError } = useDigestStore();

  useEffect(() => {
    // 初期表示時に全てのダイジェストを生成
    categories.forEach((category) => {
      if (!digests[category]) {
        generateDigest(category);
      }
    });
  }, [digests, generateDigest]);

  const handleRegenerate = (category: string) => {
    generateDigest(category);
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
              categories.forEach((category) => {
                generateDigest(category);
              });
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
        <h1 className="text-3xl font-bold text-gray-100 flex items-center space-x-3">
          <span className="text-3xl">📰</span>
          <span>今日のダイジェスト</span>
        </h1>
        <button
          type="button"
          onClick={() => {
            categories.forEach((category) => {
              generateDigest(category);
            });
          }}
          disabled={isGenerating}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          全て生成▶
        </button>
      </div>

      <div className="space-y-6">
        {isGenerating ? (
          <DigestSkeleton count={3} />
        ) : (
          categories.map((category) => {
            const digest = digests[category];

            return (
              <DigestCard
                key={category}
                category={category}
                summary={digest?.summary || ''}
                articleCount={digest?.article_count || 0}
                generatedAt={digest?.generated_at || new Date().toISOString()}
                onGenerate={() => handleRegenerate(category)}
                isGenerating={isGenerating}
              />
            );
          })
        )}
      </div>

      {!isGenerating && Object.keys(digests).length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-4">ダイジェストがありません</div>
          <div className="text-gray-500 text-sm">
            上記のボタンから各カテゴリのダイジェストを生成してください
          </div>
        </div>
      )}
    </div>
  );
};
