import { invoke } from '@tauri-apps/api/core';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { FeedDto } from '../../types';

export const FeedsSection: React.FC = () => {
  const [feeds, setFeeds] = useState<FeedDto[]>([]);

  const refresh = (): void => {
    invoke<FeedDto[]>('get_feeds')
      .then(setFeeds)
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (feedId: number): Promise<void> => {
    if (!window.confirm('このフィードを削除しますか？')) return;
    try {
      await invoke('delete_feed', { feedId });
      setFeeds((prev) => prev.filter((f) => f.id !== feedId));
    } catch (_) {
      /* silent */
    }
  };

  const handleReenable = async (feedId: number): Promise<void> => {
    try {
      await invoke('reenable_feed', { feedId });
      refresh();
    } catch (_) {
      /* silent */
    }
  };

  const handleRetry = async (feedId: number): Promise<void> => {
    try {
      await invoke('refresh_feed', { feedId });
      refresh();
    } catch (_) {
      /* silent */
    }
  };

  const handleExport = async (): Promise<void> => {
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
    } catch (_) {
      /* silent */
    }
  };

  const handleImport = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.opml,.xml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const count = await invoke<number>('import_opml', { xml: text });
        window.alert(`${count}件のフィードをインポートしました`);
        refresh();
      } catch (err) {
        window.alert(`インポート失敗: ${err instanceof Error ? err.message : '不明なエラー'}`);
      }
    };
    input.click();
  };

  // 要注意フィードを上に表示: 無効 → エラーあり → 健全（名前順）
  const sorted = [...feeds].sort((a, b) => {
    const priorityA = !a.enabled ? 0 : a.consecutiveErrors > 0 ? 1 : 2;
    const priorityB = !b.enabled ? 0 : b.consecutiveErrors > 0 ? 1 : 2;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={handleExport} className="card-action-btn secondary">
          OPML エクスポート
        </button>
        <button type="button" onClick={handleImport} className="card-action-btn primary">
          OPML インポート
        </button>
      </div>

      <div className="space-y-2">
        {sorted.map((feed) => (
          <FeedCard
            key={feed.id}
            feed={feed}
            onDelete={handleDelete}
            onReenable={handleReenable}
            onRetry={handleRetry}
          />
        ))}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
const FeedCard: React.FC<{
  feed: FeedDto;
  onDelete: (id: number) => void;
  onReenable: (id: number) => void;
  onRetry: (id: number) => void;
}> = ({ feed, onDelete, onReenable, onRetry }) => {
  const hasError = feed.consecutiveErrors > 0;
  const statusColor = !feed.enabled
    ? 'var(--badge-hot)'
    : hasError
      ? '#f59e0b'
      : 'var(--badge-new)';

  return (
    <div className="discover-card py-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: statusColor }}
            />
            <p className="text-sm font-medium truncate text-[var(--text-primary)]">{feed.name}</p>
          </div>
          <p className="text-xs truncate mt-0.5 ml-4 text-[var(--text-tertiary)]">{feed.url}</p>
          <div className="flex items-center gap-2 mt-1.5 ml-4">
            <span className="source-badge cat-badge">{feed.category}</span>
            {!feed.enabled && (
              <span className="text-xs text-[var(--badge-hot)]">
                無効{feed.disabledReason ? `: ${feed.disabledReason}` : ''}
              </span>
            )}
            {hasError && feed.enabled && (
              <span className="text-xs text-[#f59e0b]">エラー {feed.consecutiveErrors}回</span>
            )}
          </div>
          {feed.lastError && (
            <p className="text-xs mt-1 ml-4 truncate text-[var(--text-tertiary)]">
              {feed.lastError}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!feed.enabled && (
            <button
              type="button"
              onClick={() => onReenable(feed.id)}
              className="card-action-btn primary text-xs"
            >
              再有効化
            </button>
          )}
          {feed.enabled && hasError && (
            <button
              type="button"
              onClick={() => onRetry(feed.id)}
              className="card-action-btn secondary text-xs"
            >
              再取得
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(feed.id)}
            className="card-action-btn secondary text-xs text-[var(--badge-hot)]"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
};
