import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useEffect, useState } from 'react';

interface KeywordFilter {
  id: number;
  keyword: string;
  filter_type: string;
  category: string | null;
  created_at: string;
}

export const KeywordFilterSection: React.FC = () => {
  const [filters, setFilters] = useState<KeywordFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState('');
  const [newFilterType, setNewFilterType] = useState<'mute' | 'highlight'>('mute');
  const [newCategory, setNewCategory] = useState('');

  const fetchFilters = async () => {
    try {
      const result = await invoke<KeywordFilter[]>('get_keyword_filters');
      setFilters(result);
    } catch (error) {
      console.error('Failed to fetch keyword filters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addFilter = async () => {
    if (!newKeyword.trim()) return;

    try {
      const result = await invoke<KeywordFilter>('add_keyword_filter', {
        keyword: newKeyword.trim(),
        filterType: newFilterType,
        category: newCategory.trim() || null,
      });

      setFilters((prev) => [result, ...prev]);
      setNewKeyword('');
      setNewCategory('');
    } catch (error) {
      console.error('Failed to add keyword filter:', error);
    }
  };

  const removeFilter = async (id: number) => {
    try {
      await invoke('remove_keyword_filter', { id });
      setFilters((prev) => prev.filter((f) => f.id !== id));
    } catch (error) {
      console.error('Failed to remove keyword filter:', error);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const muteFilters = filters.filter((f) => f.filter_type === 'mute');
  const highlightFilters = filters.filter((f) => f.filter_type === 'highlight');

  return (
    <div className="space-y-6">
      {/* ミュートワード */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">🔇 ミュートワード</h3>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="ミュートするキーワード"
            className="flex-1 px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            onKeyPress={(e) => e.key === 'Enter' && addFilter()}
          />
          <select
            value={newFilterType}
            onChange={(e) => setNewFilterType(e.target.value as 'mute' | 'highlight')}
            className="px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            title="フィルタータイプを選択"
          >
            <option value="mute">ミュート</option>
            <option value="highlight">ハイライト</option>
          </select>
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="カテゴリー（任意）"
            className="px-3 py-2 bg-gray-700 text-gray-100 rounded border border-gray-600 focus:border-blue-500 focus:outline-none w-32"
          />
          <button
            type="button"
            onClick={addFilter}
            disabled={!newKeyword.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            追加
          </button>
        </div>

        <div className="space-y-2">
          {muteFilters.map((filter) => (
            <div
              key={filter.id}
              className="flex items-center justify-between p-3 bg-gray-700 rounded"
            >
              <div className="flex-1">
                <span className="text-gray-100 font-medium">{filter.keyword}</span>
                {filter.category && (
                  <span className="ml-2 px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded">
                    {filter.category}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeFilter(filter.id)}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
              >
                削除
              </button>
            </div>
          ))}
          {muteFilters.length === 0 && !isLoading && (
            <div className="text-gray-400 text-center py-4">ミュートワードがありません</div>
          )}
        </div>
      </div>

      {/* ハイライトワード */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">✨ ハイライトワード</h3>

        <div className="space-y-2">
          {highlightFilters.map((filter) => (
            <div
              key={filter.id}
              className="flex items-center justify-between p-3 bg-gray-700 rounded"
            >
              <div className="flex-1">
                <span className="text-gray-100 font-medium">{filter.keyword}</span>
                {filter.category && (
                  <span className="ml-2 px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded">
                    {filter.category}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeFilter(filter.id)}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
              >
                削除
              </button>
            </div>
          ))}
          {highlightFilters.length === 0 && !isLoading && (
            <div className="text-gray-400 text-center py-4">ハイライトワードがありません</div>
          )}
        </div>
      </div>

      {isLoading && <div className="text-gray-400 text-center py-4">読み込み中...</div>}
    </div>
  );
};
