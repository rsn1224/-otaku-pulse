import type React from 'react';

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'J', description: '次の記事にフォーカス移動' },
    { key: 'K', description: '前の記事にフォーカス移動' },
    { key: 'O', description: 'フォーカス中の記事を外部リンクで開く' },
    { key: 'M', description: 'フォーカス中の記事を既読/未読トグル' },
    { key: 'B', description: 'フォーカス中の記事をブックマークトグル' },
    { key: 'R', description: 'フィードを更新' },
    { key: '/', description: '検索バーにフォーカス' },
    { key: '1-4', description: 'Wingを切り替え (1:Dashboard, 2:NEWS, 3:DIGEST, 4:SETTINGS)' },
    { key: 'Esc', description: 'フォーカスを解除' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-100">キーボードショートカット</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex justify-between items-center py-2 border-b border-gray-700 last:border-b-0"
            >
              <kbd className="px-2 py-1 bg-gray-700 text-gray-200 rounded text-sm font-mono">
                {shortcut.key}
              </kbd>
              <span className="text-gray-300 text-sm">{shortcut.description}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
