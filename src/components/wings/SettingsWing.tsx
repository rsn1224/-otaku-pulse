import { invoke } from '@tauri-apps/api/core';
import React, { useState } from 'react';
import type { FeedDto } from '../../types';
import { CollectButton } from '../common/CollectButton';
import { AppearanceSection } from '../settings/AppearanceSection';
import { KeywordFilterSection } from '../settings/KeywordFilterSection';
import { LlmSettingsSection } from '../settings/LlmSettingsSection';
import { SchedulerSection } from '../settings/SchedulerSection';

export const SettingsWing: React.FC = () => {
  const [feeds, setFeeds] = useState<FeedDto[]>([]);

  // フィード一覧を取得
  React.useEffect(() => {
    const fetchFeeds = async () => {
      try {
        const feedList = await invoke<FeedDto[]>('get_feeds');
        setFeeds(feedList);
      } catch (error) {
        console.error('Failed to fetch feeds:', error);
      }
    };
    fetchFeeds();
  }, []);

  const handleExportOpml = async () => {
    try {
      const opml = await invoke<string>('export_opml');
      const blob = new Blob([opml], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'otaku-pulse-feeds.opml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('OPML export failed:', error);
    }
  };

  const handleImportOpml = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.opml,.xml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const imported = await invoke<number>('import_opml', { xml: text });
          alert(`${imported}件のフィードをインポートしました`);
        } catch (error) {
          console.error('OPML import failed:', error);
          alert('OPMLのインポートに失敗しました');
        }
      }
    };
    input.click();
  };

  const handleDeleteFeed = async (feedId: number) => {
    if (confirm('本当にこのフィードを削除しますか？関連する記事も削除されます。')) {
      try {
        await invoke('delete_feed', { feedId });
        // フィード一覧を再取得
        const feedList = await invoke<FeedDto[]>('get_feeds');
        setFeeds(feedList);
      } catch (error) {
        console.error('Failed to delete feed:', error);
        alert('フィードの削除に失敗しました');
      }
    }
  };

  const handleCleanup = async () => {
    const days = prompt('何日以上前の既読・未ブックマーク記事を削除しますか？（例: 30）');
    if (days && !Number.isNaN(Number(days))) {
      try {
        const deleted = await invoke<number>('cleanup_old_articles', { daysOld: Number(days) });
        alert(`${deleted}件の記事を削除しました`);
      } catch (error) {
        console.error('Cleanup failed:', error);
        alert('データクリーンアップに失敗しました');
      }
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">設定</h1>

      <div className="max-w-4xl space-y-6">
        {/* Data Collection */}
        <CollectButton />

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">外観</h2>
          </div>
          <div className="p-6">
            <AppearanceSection />
          </div>
        </div>

        {/* LLM Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">LLM設定</h2>
          </div>
          <div className="p-6">
            <LlmSettingsSection />
          </div>
        </div>

        {/* Scheduler Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              スケジューラー設定
            </h2>
          </div>
          <div className="p-6">
            <SchedulerSection />
          </div>
        </div>

        {/* Keyword Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              キーワードフィルター
            </h2>
          </div>
          <div className="p-6">
            <KeywordFilterSection />
          </div>
        </div>

        {/* OPML Import/Export */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">フィード管理</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleExportOpml}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                OPML エクスポート
              </button>
              <button
                type="button"
                onClick={handleImportOpml}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                OPML インポート
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              OPML形式でフィードリストのエクスポート/インポートができます
            </p>
          </div>
        </div>

        {/* Feed Management */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">フィード管理</h2>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              フィード追加
            </button>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{feed.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{feed.url}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        カテゴリー: {feed.category}
                      </span>
                      <span
                        className={`text-sm ${feed.enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                      >
                        {feed.enabled ? '有効' : '無効'}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFeed(feed.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Cleanup */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              データクリーンアップ
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleCleanup}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                古い記事を削除
              </button>
            </div>
            <p className="text-sm text-gray-400">
              指定した日数より前の既読・未ブックマーク記事を削除します。ブックマーク済み記事は削除されません。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
