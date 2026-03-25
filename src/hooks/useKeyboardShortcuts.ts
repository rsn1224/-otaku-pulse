import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { useFeedStore } from '../stores/feedStore';
import { useArticleStore } from '../stores/useArticleStore';

export function useKeyboardShortcuts(): void {
  const { setFocusedIndex, focusNext, focusPrev, focusedIndex, articles } = useArticleStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 入力フィールドでは無効
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '1':
          // Dashboard wing - TODO: implement navigation
          console.log('Navigate to dashboard');
          break;
        case '2':
          // Feed wing - TODO: implement navigation
          console.log('Navigate to feed');
          break;
        case '3':
          // Digest wing - TODO: implement navigation
          console.log('Navigate to digest');
          break;
        case '4':
          // Settings wing - TODO: implement navigation
          console.log('Navigate to settings');
          break;
        case 'r':
        case 'R':
          useFeedStore.getState().refreshFeeds();
          break;
        case '/': {
          e.preventDefault();
          // 検索バーにフォーカス
          const searchInput = document.querySelector(
            'input[placeholder="記事を検索..."]',
          ) as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
          break;
        }
        case 'j':
        case 'J':
          e.preventDefault();
          focusNext();
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          focusPrev();
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < articles.length) {
            const article = articles[focusedIndex];
            if (article.url) {
              invoke('open_external', { url: article.url });
            }
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < articles.length) {
            const article = articles[focusedIndex];
            useArticleStore.getState().markRead(article.id);
          }
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < articles.length) {
            const article = articles[focusedIndex];
            invoke('toggle_bookmark', { articleId: article.id });
          }
          break;
        case '?':
          e.preventDefault();
          // TODO: ヘルプモーダル表示
          console.log('Show keyboard help');
          break;
        case 'Escape':
          // パネルを閉じる（将来の実装用）
          setFocusedIndex(-1);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setFocusedIndex, focusNext, focusPrev, focusedIndex, articles]);
}
