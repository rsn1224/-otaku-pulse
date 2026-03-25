import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useState } from 'react';

interface CollectResult {
  fetched: number;
  saved: number;
  deduped: number;
  errors: string[];
}

export const CollectButton: React.FC = () => {
  const [result, setResult] = useState<CollectResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  const handleCollect = async () => {
    setLoading(true);
    try {
      const res = await invoke<CollectResult>('run_collect_now');
      setResult(res);
    } catch (e) {
      console.error('Collection failed:', e);
      setResult({
        fetched: 0,
        saved: 0,
        deduped: 0,
        errors: [String(e)],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInitFeeds = async () => {
    setInitLoading(true);
    try {
      const added = await invoke<number>('init_default_feeds');
      alert(`${added}件の初期フィードを追加しました`);
    } catch (e) {
      console.error('Failed to init feeds:', e);
      alert('初期フィードの追加に失敗しました');
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow border border-gray-700">
      <h2 className="text-xl font-semibold mb-4">データ収集</h2>

      <div className="space-y-4">
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={handleInitFeeds}
            disabled={initLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {initLoading ? '追加中...' : '初期フィードを追加'}
          </button>

          <button
            type="button"
            onClick={handleCollect}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '収集中...' : '今すぐ収集'}
          </button>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-gray-900 rounded-md">
            <h3 className="font-medium mb-2">収集結果</h3>
            <div className="text-sm space-y-1">
              <div>取得: {result.fetched}件</div>
              <div>保存: {result.saved}件</div>
              <div>重複スキップ: {result.deduped}件</div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-3">
                <h4 className="font-medium text-red-400 mb-1">エラー</h4>
                <div className="text-xs text-red-300 space-y-1">
                  {result.errors.map((error, index) => (
                    <div key={`skeleton-${index}`}>{error}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
