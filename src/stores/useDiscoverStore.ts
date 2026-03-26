import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type {
  AiSearchResult,
  ArticleDetailDto,
  ArticleDto,
  Citation,
  DiscoverArticleDto,
  DiscoverFeedResult,
  DiscoverTab,
  HighlightEntry,
} from '../types';

interface DiscoverState {
  tab: DiscoverTab;
  articles: DiscoverArticleDto[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  offset: number;

  // Highlights
  highlights: HighlightEntry[];
  highlightsLoading: boolean;
  highlightsError: boolean;
  highlightsFetchedAt: number;

  // Search
  searchQuery: string;
  searchResults: ArticleDto[];
  aiAnswer: string | null;
  aiCitations: Citation[];
  isSearching: boolean;
  searchMode: boolean;

  setTab: (tab: DiscoverTab) => void;
  fetchFeed: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  toggleBookmark: (id: number) => Promise<void>;
  recordInteraction: (articleId: number, action: string, dwellSeconds?: number) => Promise<void>;
  updateArticleSummary: (id: number, summary: string) => void;
  clearError: () => void;

  fetchHighlights: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  executeSearch: () => Promise<void>;
  clearSearch: () => void;

  // Reader
  readerArticle: ArticleDetailDto | null;
  readerLoading: boolean;
  openReader: (articleId: number) => Promise<void>;
  closeReader: () => void;
  openNextArticle: () => void;
  openPrevArticle: () => void;

  // Unread counts
  unreadCounts: Record<string, number>;
  fetchUnreadCounts: () => Promise<void>;
  markAllReadCategory: (category: string) => Promise<void>;

  // Scroll position memory
  scrollPositions: Record<string, number>;
  saveScrollPosition: (tab: string, pos: number) => void;

  // Keyboard navigation
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  focusNext: () => void;
  focusPrev: () => void;

  // Help modal
  showHelp: boolean;
  toggleHelp: () => void;
}

const PAGE_SIZE = 30;

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  tab: 'for_you',
  articles: [],
  total: 0,
  hasMore: true,
  isLoading: false,
  error: null,
  offset: 0,

  highlights: [],
  highlightsLoading: false,
  highlightsError: false,

  searchQuery: '',
  searchResults: [],
  aiAnswer: null,
  aiCitations: [],
  isSearching: false,
  searchMode: false,

  setTab: (tab: DiscoverTab) => {
    set({
      tab,
      offset: 0,
      hasMore: true,
      searchMode: false,
      searchQuery: '',
      focusedIndex: -1,
      error: null,
    });
    get().fetchFeed(true);
  },

  fetchFeed: async (reset = false) => {
    const { tab, offset } = get();
    const newOffset = reset ? 0 : offset;
    set({ isLoading: true, error: null });

    try {
      const result: DiscoverFeedResult = await invoke('get_discover_feed', {
        tab,
        limit: PAGE_SIZE,
        offset: newOffset,
      });
      const newArticles = reset ? result.articles : [...get().articles, ...result.articles];
      set({
        articles: newArticles,
        total: result.total,
        hasMore: result.hasMore,
        offset: newOffset + result.articles.length,
        isLoading: false,
      });
    } catch (_) {
      set({ error: 'フィードの取得に失敗しました', isLoading: false });
    }
  },

  loadMore: async () => {
    const { isLoading, hasMore } = get();
    if (isLoading || !hasMore) return;
    await get().fetchFeed(false);
  },

  markRead: async (id: number) => {
    try {
      await invoke('mark_read', { articleId: id });
      set({
        articles: get().articles.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
      });
    } catch (_) {
      /* silent */
    }
  },

  toggleBookmark: async (id: number) => {
    try {
      await invoke('toggle_bookmark', { articleId: id });
      set({
        articles: get().articles.map((a) =>
          a.id === id ? { ...a, isBookmarked: !a.isBookmarked } : a,
        ),
      });
    } catch (_) {
      /* silent */
    }
  },

  recordInteraction: async (articleId: number, action: string, dwellSeconds?: number) => {
    try {
      await invoke('record_interaction', {
        articleId,
        action,
        dwellSeconds: dwellSeconds ?? null,
      });
    } catch (_) {
      /* silent */
    }
  },

  updateArticleSummary: (id: number, summary: string) => {
    set({
      articles: get().articles.map((a) => (a.id === id ? { ...a, aiSummary: summary } : a)),
    });
  },

  clearError: () => set({ error: null }),

  highlightsFetchedAt: 0,

  fetchHighlights: async () => {
    // 5 分以内の再取得はスキップ（TTL キャッシュ）
    const now = Date.now();
    if (now - get().highlightsFetchedAt < 300000 && get().highlights.length > 0) return;

    set({ highlightsLoading: true, highlightsError: false });
    try {
      const highlights = await invoke<HighlightEntry[]>('get_daily_highlights');
      set({ highlights, highlightsLoading: false, highlightsFetchedAt: now });
    } catch (_) {
      set({ highlightsLoading: false, highlightsError: true });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchMode: false, searchResults: [] });
    }
  },

  executeSearch: async () => {
    const { searchQuery } = get();
    const q = searchQuery.trim();
    if (!q) return;

    set({ isSearching: true, searchMode: true, aiAnswer: null, aiCitations: [] });
    try {
      const result = await invoke<AiSearchResult>('ai_search', { query: q });
      set({
        searchResults: result.localArticles,
        aiAnswer: result.aiAnswer,
        aiCitations: result.citations,
        isSearching: false,
      });
    } catch (_) {
      set({ isSearching: false, searchResults: [], aiAnswer: null, aiCitations: [] });
    }
  },

  clearSearch: () => {
    set({ searchMode: false, searchQuery: '', searchResults: [], aiAnswer: null, aiCitations: [] });
  },

  // Reader
  readerArticle: null,
  readerLoading: false,

  openReader: async (articleId: number) => {
    set({ readerLoading: true });
    try {
      const detail = await invoke<ArticleDetailDto>('get_article_detail', { articleId });
      set({ readerArticle: detail, readerLoading: false });
      // 既読にする
      get().markRead(articleId);
      get().recordInteraction(articleId, 'open');
    } catch (_) {
      set({ readerLoading: false });
    }
  },

  closeReader: () => {
    set({ readerArticle: null });
  },

  openNextArticle: () => {
    const { readerArticle, articles, openReader } = get();
    if (!readerArticle || articles.length === 0) return;
    const idx = articles.findIndex((a) => a.id === readerArticle.id);
    const nextIdx = idx >= articles.length - 1 ? 0 : idx + 1;
    openReader(articles[nextIdx].id);
  },

  openPrevArticle: () => {
    const { readerArticle, articles, openReader } = get();
    if (!readerArticle || articles.length === 0) return;
    const idx = articles.findIndex((a) => a.id === readerArticle.id);
    const prevIdx = idx <= 0 ? articles.length - 1 : idx - 1;
    openReader(articles[prevIdx].id);
  },

  // Unread counts
  unreadCounts: {},

  fetchUnreadCounts: async () => {
    try {
      const counts = await invoke<Record<string, number>>('get_unread_counts');
      set({ unreadCounts: counts });
    } catch (_) {
      /* silent */
    }
  },

  markAllReadCategory: async (category: string) => {
    try {
      await invoke('mark_all_read_category', { category });
      get().fetchUnreadCounts();
      get().fetchFeed(true);
    } catch (_) {
      /* silent */
    }
  },

  // Scroll positions
  scrollPositions: {},

  saveScrollPosition: (tab: string, pos: number) => {
    set({ scrollPositions: { ...get().scrollPositions, [tab]: pos } });
  },

  // Keyboard navigation
  focusedIndex: -1,

  setFocusedIndex: (i: number) => set({ focusedIndex: i }),

  focusNext: () => {
    const { focusedIndex, articles } = get();
    if (articles.length === 0) return;
    set({ focusedIndex: Math.min(focusedIndex + 1, articles.length - 1) });
  },

  focusPrev: () => {
    const { focusedIndex } = get();
    set({ focusedIndex: Math.max(focusedIndex - 1, 0) });
  },

  // Help modal
  showHelp: false,
  toggleHelp: () => set({ showHelp: !get().showHelp }),
}));
