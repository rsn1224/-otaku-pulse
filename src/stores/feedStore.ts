import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type { ArticleDto, Category, FeedDto } from '../types';

interface FeedState {
  feeds: FeedDto[];
  articles: ArticleDto[];
  selectedCategory: Category | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  searchResults: ArticleDto[];
  unreadCount: number;
  fetchFeeds: () => Promise<void>;
  fetchArticles: (category?: Category) => Promise<void>;
  markAsRead: (articleId: number) => Promise<void>;
  toggleBookmark: (articleId: number) => Promise<void>;
  setSelectedCategory: (category: Category | null) => void;
  refreshFeeds: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  searchArticles: (query: string) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
}

export const useFeedStore = create<FeedState>()((set, get) => ({
  feeds: [],
  articles: [],
  selectedCategory: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  searchResults: [],
  unreadCount: 0,

  fetchFeeds: async () => {
    set({ isLoading: true, error: null });
    try {
      const feeds = await invoke<FeedDto[]>('get_feeds');
      set({ feeds, isLoading: false });
    } catch (error) {
      set({ error: error as string, isLoading: false });
    }
  },

  fetchArticles: async (category?: Category) => {
    set({ isLoading: true, error: null });
    try {
      const articles = await invoke<ArticleDto[]>('get_articles', { category });
      set({ articles, isLoading: false });
    } catch (error) {
      set({ error: error as string, isLoading: false });
    }
  },

  markAsRead: async (articleId: number) => {
    try {
      await invoke('mark_as_read', { articleId });
      set((state) => ({
        articles: state.articles.map((article) =>
          article.id === articleId ? { ...article, isRead: true } : article,
        ),
      }));
    } catch (error) {
      set({ error: error as string });
    }
  },

  toggleBookmark: async (articleId: number) => {
    try {
      await invoke('toggle_bookmark', { articleId });
      set((state) => ({
        articles: state.articles.map((article) =>
          article.id === articleId ? { ...article, isBookmarked: !article.isBookmarked } : article,
        ),
      }));
    } catch (error) {
      set({ error: error as string });
    }
  },

  setSelectedCategory: (category: Category | null) => set({ selectedCategory: category }),

  refreshFeeds: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke<number>('refresh_feeds');
      await get().fetchFeeds();
      const cat = get().selectedCategory;
      await get().fetchArticles(cat ?? undefined);
    } catch (error) {
      set({ error: error as string, isLoading: false });
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  searchArticles: async (query: string) => {
    set({ isLoading: true, error: null });
    try {
      const results = await invoke<ArticleDto[]>('search_articles', { query, limit: 50 });
      set({ searchResults: results, isLoading: false });
    } catch (error) {
      set({ error: error as string, isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const count = await invoke<number>('get_unread_count');
      set({ unreadCount: count });
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  },
}));
