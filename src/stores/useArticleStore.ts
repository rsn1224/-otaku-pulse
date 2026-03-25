import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import {
  applyMuteFilters,
  filterByCategory,
  getHighlightKeywords,
  separateFiltersByType,
} from '../lib/articleFilter';

interface ArticleRow {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  category: string;
  published_at: string | null;
  is_read: boolean;
  thumbnail_url: string | null;
}

interface ArticleQuery {
  category?: string | null;
  source?: string | null;
  unread_only?: boolean;
  limit?: number;
  offset?: number;
}

interface ArticleListResult {
  articles: ArticleRow[];
  total: number;
  has_more: boolean;
}

interface KeywordFilter {
  id: number;
  keyword: string;
  filter_type: string;
  category: string | null;
  created_at: string;
}

/** ミュートフィルタ適用済み記事を計算 */
function computeFiltered(
  articles: ArticleRow[],
  keywordFilters: KeywordFilter[],
  category: string | null,
): ArticleRow[] {
  const categoryFiltered =
    keywordFilters.length > 0
      ? filterByCategory(keywordFilters, category || 'all')
      : keywordFilters;
  const { mute } = separateFiltersByType(categoryFiltered);
  return applyMuteFilters(articles, mute);
}

interface ArticleState {
  articles: ArticleRow[];
  filteredArticles: ArticleRow[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  category: string | null;
  unreadOnly: boolean;
  offset: number;
  keywordFilters: KeywordFilter[];
  viewMode: 'list' | 'cluster';
  focusedIndex: number;
  fetchArticles: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  setCategory: (cat: string | null) => void;
  setUnreadOnly: (v: boolean) => void;
  setViewMode: (mode: 'list' | 'cluster') => void;
  clearError: () => void;
  setFocusedIndex: (index: number) => void;
  focusNext: () => void;
  focusPrev: () => void;
  fetchKeywordFilters: () => Promise<void>;
  addKeywordFilter: (keyword: string, filterType: string, category?: string) => Promise<void>;
  removeKeywordFilter: (id: number) => Promise<void>;
  getArticleHighlights: (article: ArticleRow) => string[];
}

export const useArticleStore = create<ArticleState>((set, get) => ({
  articles: [],
  filteredArticles: [],
  total: 0,
  hasMore: true,
  isLoading: false,
  error: null,
  category: null,
  unreadOnly: false,
  offset: 0,
  keywordFilters: [],
  viewMode: 'list',
  focusedIndex: -1,

  fetchArticles: async (reset = false) => {
    const { category, unreadOnly, offset, keywordFilters } = get();
    const newOffset = reset ? 0 : offset;

    set({ isLoading: true, error: null });

    try {
      const query: ArticleQuery = {
        category,
        unread_only: unreadOnly,
        limit: 50,
        offset: newOffset,
      };

      const result: ArticleListResult = await invoke('get_articles', { query });
      const newArticles = reset ? result.articles : [...get().articles, ...result.articles];

      set({
        articles: newArticles,
        filteredArticles: computeFiltered(newArticles, keywordFilters, category),
        total: result.total,
        hasMore: result.has_more,
        offset: newOffset + result.articles.length,
        isLoading: false,
      });
    } catch (_) {
      set({ error: 'Failed to fetch articles', isLoading: false });
    }
  },

  loadMore: async () => {
    const { isLoading, hasMore } = get();
    if (isLoading || !hasMore) return;
    await get().fetchArticles(false);
  },

  markRead: async (id: number) => {
    try {
      await invoke('mark_read', { articleId: id });
      const { keywordFilters, category } = get();
      const newArticles = get().articles.map((a) =>
        a.id === id ? { ...a, is_read: true } : a,
      );
      set({
        articles: newArticles,
        filteredArticles: computeFiltered(newArticles, keywordFilters, category),
      });
    } catch (_) {
      set({ error: 'Failed to mark as read' });
    }
  },

  markAllRead: async () => {
    const { category, keywordFilters } = get();
    try {
      await invoke('mark_all_read', { category });
      const newArticles = get().articles.map((a) => ({ ...a, is_read: true }));
      set({
        articles: newArticles,
        filteredArticles: computeFiltered(newArticles, keywordFilters, category),
      });
    } catch (_) {
      set({ error: 'Failed to mark all as read' });
    }
  },

  setCategory: (cat: string | null) => {
    const { articles, keywordFilters } = get();
    set({
      category: cat,
      filteredArticles: computeFiltered(articles, keywordFilters, cat),
    });
    get().fetchArticles(true);
  },

  setUnreadOnly: (v: boolean) => {
    set({ unreadOnly: v });
    get().fetchArticles(true);
  },

  setViewMode: (mode: 'list' | 'cluster') => {
    set({ viewMode: mode });
  },

  clearError: () => set({ error: null }),
  setFocusedIndex: (index: number) => set({ focusedIndex: index }),

  focusNext: () => {
    const { focusedIndex, filteredArticles } = get();
    if (focusedIndex < filteredArticles.length - 1) {
      set({ focusedIndex: focusedIndex + 1 });
    }
  },

  focusPrev: () => {
    const { focusedIndex } = get();
    if (focusedIndex > 0) {
      set({ focusedIndex: focusedIndex - 1 });
    }
  },

  fetchKeywordFilters: async () => {
    try {
      const filters = await invoke<KeywordFilter[]>('get_keyword_filters');
      const { articles, category } = get();
      set({
        keywordFilters: filters,
        filteredArticles: computeFiltered(articles, filters, category),
      });
    } catch (_) {
      set({ error: 'Failed to fetch keyword filters' });
    }
  },

  addKeywordFilter: async (keyword: string, filterType: string, category?: string) => {
    try {
      const newFilter = await invoke<KeywordFilter>('add_keyword_filter', {
        keyword,
        filterType,
        category: category || null,
      });
      const newFilters = [newFilter, ...get().keywordFilters];
      const { articles, category: cat } = get();
      set({
        keywordFilters: newFilters,
        filteredArticles: computeFiltered(articles, newFilters, cat),
      });
    } catch (_) {
      set({ error: 'Failed to add keyword filter' });
    }
  },

  removeKeywordFilter: async (id: number) => {
    try {
      await invoke('remove_keyword_filter', { id });
      const newFilters = get().keywordFilters.filter((f) => f.id !== id);
      const { articles, category } = get();
      set({
        keywordFilters: newFilters,
        filteredArticles: computeFiltered(articles, newFilters, category),
      });
    } catch (_) {
      set({ error: 'Failed to remove keyword filter' });
    }
  },

  getArticleHighlights: (article: ArticleRow) => {
    const { keywordFilters, category } = get();
    const categoryFiltered =
      keywordFilters.length > 0
        ? filterByCategory(keywordFilters, category || 'all')
        : keywordFilters;
    const { highlight } = separateFiltersByType(categoryFiltered);
    return getHighlightKeywords(article, highlight);
  },
}));
