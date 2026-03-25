import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import type { ArticleDetailDto } from '../../types';

interface ArticleReaderProps {
  article: ArticleDetailDto | null;
  onClose: () => void;
}

export const ArticleReader: React.FC<ArticleReaderProps> = ({ article, onClose }) => {
  // Escapeキーで閉じる
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!article) return null;

  const openOriginalArticle = async () => {
    if (article.url) {
      await invoke('shell_open', { url: article.url });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        role="presentation"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      />

      {/* スライドインパネル（右側60%幅） */}
      <div className="fixed right-0 top-0 h-full w-3/5 bg-gray-800 shadow-xl overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gray-900 border-b border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-100 truncate flex-1">{article.title}</h2>
          <button
            type="button"
            onClick={onClose}
            title="閉じる"
            className="ml-4 p-2 text-gray-400 hover:text-gray-100"
          >
            <svg
              aria-hidden="true"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* メタ情報 */}
        <div className="bg-gray-750 border-b border-gray-700 p-4">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            {article.feedName && <span>フィード: {article.feedName}</span>}
            {article.publishedAt && (
              <span>公開: {new Date(article.publishedAt).toLocaleDateString('ja-JP')}</span>
            )}
            {article.author && <span>著者: {article.author}</span>}
            <span>重要度: {article.importanceScore.toFixed(2)}</span>
          </div>
          <div className="mt-3 flex space-x-2">
            <button
              type="button"
              onClick={openOriginalArticle}
              disabled={!article.url}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              元記事を開く
            </button>
          </div>
        </div>

        {/* 本文 */}
        <div className="flex-1 overflow-auto p-6">
          <div className="prose prose-invert max-w-none">
            {/* contentがあれば表示、なければsummaryを表示 */}
            {article.content ? (
              <div className="text-gray-100 leading-relaxed whitespace-pre-wrap">
                {article.content}
              </div>
            ) : article.summary ? (
              <p className="text-gray-100 leading-relaxed">{article.summary}</p>
            ) : (
              <p className="text-gray-400 italic">記事内容がありません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
