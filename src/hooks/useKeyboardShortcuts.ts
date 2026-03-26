import { useEffect } from 'react';

/** v2 キーボードショートカット（"/" は TopBarSearch で直接処理） */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'r':
        case 'R':
          // 将来: フィード再収集
          break;
        case 'Escape':
          // 将来: パネル閉じる
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
