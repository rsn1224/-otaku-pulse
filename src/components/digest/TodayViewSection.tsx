import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getTodayView } from '../../lib/tauri-commands';
import type { TodayViewItem } from '../../types';

export function TodayViewSection(): React.JSX.Element {
  const [items, setItems] = useState<TodayViewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTodayView();
      setItems(data);
      if (data.length > 0 && data[0]) {
        setGeneratedAt(data[0].generatedAt);
      }
    } catch {
      // フォールバック: 空表示
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="shrink-0 px-4 py-3 border-b border-(--surface-variant) bg-(--surface)">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-(--primary) uppercase tracking-wider">
          Today
        </span>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-xs text-(--on-surface-variant)">{formatTime(generatedAt)}</span>
          )}
          <button
            type="button"
            className="text-xs text-(--on-surface-variant) hover:text-(--primary) transition-colors"
            onClick={load}
            aria-label="Today View を更新"
          >
            ↻
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 rounded bg-(--surface-variant) animate-pulse w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-(--on-surface-variant)">記事がまだありません</p>
      ) : (
        <ol className="space-y-1">
          {items.map((item) => (
            <li key={item.articleId} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 w-4 font-bold text-(--primary)">{item.rank}.</span>
              <span className="text-(--on-surface) leading-snug">{item.headline}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
