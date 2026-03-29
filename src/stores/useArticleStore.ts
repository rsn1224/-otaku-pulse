import { create } from 'zustand';
import { logger } from '../lib/logger';
import {
  getUnreadCounts as fetchUnreadCountsCmd,
  getDailyHighlights,
  getDiscoverFeed,
  markAllReadCategory as markAllReadCategoryCmd,
  markRead as markReadCmd,
  recordInteraction as recordInteractionCmd,
  toggleBookmark as toggleBookmarkCmd,
} from '../lib/tauri-commands';
import type { DiscoverArticleDto, DiscoverFeedResult, DiscoverTab, HighlightEntry } from '../types';

const PAGE_SIZE = 30;

interface ArticleState {
  tab: DiscoverTab;
  articles: DiscoverArticleDto[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  offset: number;

  highlights: HighlightEntry[];
  highlightsLoading: boolean;
  highlightsError: boolean;
  highlightsFetchedAt: number;

  unreadCounts: Record<string, number>;
  scrollPositions: Record<string, number>;

  setTab: (tab: DiscoverTab) => void;
  fetchFeed: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  toggleBookmark: (id: number) => Promise<void>;
  recordInteraction: (articleId: number, action: string, dwellSeconds?: number) => Promise<void>;
  updateArticleSummary: (id: number, summary: string) => void;
  clearError: () => void;
  fetchHighlights: () => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
  markAllReadCategory: (category: string) => Promise<void>;
  saveScrollPosition: (tab: string, pos: number) => void;
}

export const useArticleStore = create<ArticleState>((set, get) => ({
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
  highlightsFetchedAt: 0,

  unreadCounts: {},
  scrollPositions: {},

  setTab: (tab: DiscoverTab) => {
    set({
      tab,
      offset: 0,
      hasMore: true,
      error: null,
    });
    get().fetchFeed(true);
  },

  fetchFeed: async (reset = false) => {
    const { tab, offset } = get();
    const newOffset = reset ? 0 : offset;
    set({ isLoading: true, error: null });

    try {
      const result: DiscoverFeedResult = await getDiscoverFeed(tab, PAGE_SIZE, newOffset);
      const newArticles = reset ? result.articles : [...get().articles, ...result.articles];
      set({
        articles: newArticles,
        total: result.total,
        hasMore: result.hasMore,
        offset: newOffset + result.articles.length,
        isLoading: false,
      });
    } catch (e) {
      logger.error({ tab, error: e }, 'fetchFeed failed');
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
      await markReadCmd(id);
      set({
        articles: get().articles.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
      });
    } catch (e) {
      logger.warn({ articleId: id, error: e }, 'markRead failed');
    }
  },

  toggleBookmark: async (id: number) => {
    try {
      await toggleBookmarkCmd(id);
      set({
        articles: get().articles.map((a) =>
          a.id === id ? { ...a, isBookmarked: !a.isBookmarked } : a,
        ),
      });
    } catch (e) {
      logger.warn({ articleId: id, error: e }, 'toggleBookmark failed');
    }
  },

  recordInteraction: async (articleId: number, action: string, dwellSeconds?: number) => {
    try {
      await recordInteractionCmd(articleId, action, dwellSeconds ?? null);
    } catch (e) {
      logger.debug({ articleId, action, error: e }, 'recordInteraction failed');
    }
  },

  updateArticleSummary: (id: number, summary: string) => {
    set({
      articles: get().articles.map((a) => (a.id === id ? { ...a, aiSummary: summary } : a)),
    });
  },

  clearError: () => set({ error: null }),

  fetchHighlights: async () => {
    const now = Date.now();
    if (now - get().highlightsFetchedAt < 300000 && get().highlights.length > 0) return;

    set({ highlightsLoading: true, highlightsError: false });
    try {
      const highlights = await getDailyHighlights();
      set({ highlights, highlightsLoading: false, highlightsFetchedAt: now });
    } catch (e) {
      logger.error({ error: e }, 'fetchHighlights failed');
      set({ highlightsLoading: false, highlightsError: true });
    }
  },

  fetchUnreadCounts: async () => {
    try {
      const counts = await fetchUnreadCountsCmd();
      set({ unreadCounts: counts });
    } catch (e) {
      logger.debug({ error: e }, 'fetchUnreadCounts failed');
    }
  },

  markAllReadCategory: async (category: string) => {
    try {
      await markAllReadCategoryCmd(category);
      get().fetchUnreadCounts();
      get().fetchFeed(true);
    } catch (e) {
      logger.warn({ category, error: e }, 'markAllReadCategory failed');
    }
  },

  saveScrollPosition: (tab: string, pos: number) => {
    set({ scrollPositions: { ...get().scrollPositions, [tab]: pos } });
  },
}));
