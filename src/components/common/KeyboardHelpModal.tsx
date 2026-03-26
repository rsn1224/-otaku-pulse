import type React from 'react';
import { useDiscoverStore } from '../../stores/useDiscoverStore';

const SHORTCUTS: { key: string; description: string }[] = [
  { key: 'J', description: '次の記事にフォーカス' },
  { key: 'K', description: '前の記事にフォーカス' },
  { key: 'O', description: '記事を外部ブラウザで開く' },
  { key: 'M', description: '既読/未読トグル' },
  { key: 'B', description: 'ブックマークトグル' },
  { key: '/', description: '検索にフォーカス' },
  { key: '?', description: 'このヘルプを表示' },
  { key: 'Esc', description: 'パネル/モーダルを閉じる' },
];

export const KeyboardHelpModal: React.FC = () => {
  const { showHelp, toggleHelp } = useDiscoverStore();

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="rounded-lg shadow-xl w-80 max-w-[90vw]"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-semibold">キーボードショートカット</h2>
          <button
            type="button"
            onClick={toggleHelp}
            className="text-xs px-2 py-1 rounded hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            閉じる
          </button>
        </div>
        <div className="px-4 py-3 space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-sm">
              <kbd
                className="px-2 py-0.5 rounded text-xs font-mono"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
              >
                {s.key}
              </kbd>
              <span style={{ color: 'var(--text-secondary)' }}>{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
