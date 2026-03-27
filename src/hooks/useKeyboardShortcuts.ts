import { openUrl } from '@tauri-apps/plugin-opener';
import { useEffect } from 'react';
import { logger } from '../lib/logger';
import { useArticleStore } from '../stores/useArticleStore';
import { useKeyboardStore } from '../stores/useKeyboardStore';
import { useReaderStore } from '../stores/useReaderStore';

/** P5-A キーボードショートカット（"/" は TopBarSearch で直接処理） */
export function useKeyboardShortcuts(): void {
  const { articles, markRead, toggleBookmark } = useArticleStore();
  const { focusedIndex, focusNext, focusPrev, toggleHelp, showHelp } = useKeyboardStore();
  const { closeReader, readerArticle } = useReaderStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const focused =
        focusedIndex >= 0 && focusedIndex < articles.length ? articles[focusedIndex] : null;

      switch (e.key) {
        case 'j':
        case 'J':
          focusNext();
          break;
        case 'k':
        case 'K':
          focusPrev();
          break;
        case 'o':
        case 'O':
          if (focused?.url) {
            openUrl(focused.url).catch((e) => logger.debug({ error: e }, 'openUrl via keyboard failed'));
          }
          break;
        case 'm':
        case 'M':
          if (focused) {
            markRead(focused.id);
          }
          break;
        case 'b':
        case 'B':
          if (focused) {
            toggleBookmark(focused.id);
          }
          break;
        case '?':
          toggleHelp();
          break;
        case 'Escape':
          if (showHelp) {
            toggleHelp();
          } else if (readerArticle) {
            closeReader();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    articles,
    focusedIndex,
    focusNext,
    focusPrev,
    markRead,
    toggleBookmark,
    toggleHelp,
    showHelp,
    closeReader,
    readerArticle,
  ]);
}
