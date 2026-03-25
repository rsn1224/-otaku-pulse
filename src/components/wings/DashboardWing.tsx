import { useEffect } from 'react';
import { useDigestStore } from '../../stores/digestStore';
import { useFeedStore } from '../../stores/feedStore';
import type { ArticleDto, DigestDto, FeedDto } from '../../types';

export const DashboardWing: React.FC = () => {
  const { feeds, articles, fetchFeeds, fetchArticles, isLoading } = useFeedStore();
  const { digests, fetchDigests } = useDigestStore();

  useEffect(() => {
    fetchFeeds();
    fetchArticles();
    fetchDigests();
  }, [fetchFeeds, fetchArticles, fetchDigests]);

  const stats = {
    totalFeeds: feeds.length,
    activeFeeds: feeds.filter((f: FeedDto) => f.enabled).length,
    totalArticles: articles.length,
    unreadArticles: articles.filter((a: ArticleDto) => !a.isRead).length,
    totalDigests: digests.length,
  };

  const recentDigests = digests.slice(0, 3);
  const recentArticles = articles.slice(0, 5);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={`skel-${i}`} className="h-24 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">ダッシュボード</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400">フィード数</h3>
          <p className="text-2xl font-bold text-gray-100">{stats.totalFeeds}</p>
          <p className="text-sm text-gray-400">{stats.activeFeeds} 有効</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400">記事数</h3>
          <p className="text-2xl font-bold text-gray-100">{stats.totalArticles}</p>
          <p className="text-sm text-gray-400">{stats.unreadArticles} 未読</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400">ダイジェスト</h3>
          <p className="text-2xl font-bold text-gray-100">{stats.totalDigests}</p>
          <p className="text-sm text-gray-400">生成済み</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400">カテゴリー</h3>
          <p className="text-2xl font-bold text-gray-100">5</p>
          <p className="text-sm text-gray-400">全カテゴリー</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Digests */}
        <div className="bg-gray-800 rounded-lg shadow border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-lg font-semibold">最近のダイジェスト</h2>
          </div>
          <div className="p-6">
            {recentDigests.length === 0 ? (
              <p className="text-gray-400">ダイジェストがありません</p>
            ) : (
              <div className="space-y-4">
                {recentDigests.map((digest: DigestDto) => (
                  <div key={digest.id} className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-medium text-gray-100">{digest.title}</h3>
                    <p className="text-sm text-gray-400">
                      {digest.category} • {new Date(digest.generatedAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {digest.articleCount} 記事 • {digest.modelUsed || 'Unknown'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Articles */}
        <div className="bg-gray-800 rounded-lg shadow border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-lg font-semibold">最近の記事</h2>
          </div>
          <div className="p-6">
            {recentArticles.length === 0 ? (
              <p className="text-gray-400">記事がありません</p>
            ) : (
              <div className="space-y-4">
                {recentArticles.map((article: ArticleDto) => (
                  <div key={article.id} className="flex items-start space-x-3">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${
                        article.isRead ? 'bg-gray-300' : 'bg-blue-500'
                      }`}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-100 truncate">{article.title}</h3>
                      <p className="text-sm text-gray-400">
                        {article.feedName} •{' '}
                        {new Date(article.publishedAt || '').toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
