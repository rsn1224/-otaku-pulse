import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { logger } from '../lib/logger';
import type { ArticleDetailDto } from '../types';
import { useArticleStore } from './useArticleStore';

interface ReaderState {
  readerArticle: ArticleDetailDto | null;
  readerLoading: boolean;

  openReader: (articleId: number) => Promise<void>;
  closeReader: () => void;
  openNextArticle: () => void;
  openPrevArticle: () => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  readerArticle: null,
  readerLoading: false,

  openReader: async (articleId: number) => {
    set({ readerLoading: true });
    try {
      const detail = await invoke<ArticleDetailDto>('get_article_detail', { articleId });
      set({ readerArticle: detail, readerLoading: false });
      useArticleStore.getState().markRead(articleId);
      useArticleStore.getState().recordInteraction(articleId, 'open');
    } catch (e) {
      logger.error({ articleId, error: e }, 'openReader failed');
      set({ readerLoading: false });
    }
  },

  closeReader: () => {
    set({ readerArticle: null });
  },

  openNextArticle: () => {
    const { readerArticle, openReader } = get();
    const articles = useArticleStore.getState().articles;
    if (!readerArticle || articles.length === 0) return;
    const idx = articles.findIndex((a) => a.id === readerArticle.id);
    const nextIdx = idx >= articles.length - 1 ? 0 : idx + 1;
    openReader(articles[nextIdx].id);
  },

  openPrevArticle: () => {
    const { readerArticle, openReader } = get();
    const articles = useArticleStore.getState().articles;
    if (!readerArticle || articles.length === 0) return;
    const idx = articles.findIndex((a) => a.id === readerArticle.id);
    const prevIdx = idx <= 0 ? articles.length - 1 : idx - 1;
    openReader(articles[prevIdx].id);
  },
}));
