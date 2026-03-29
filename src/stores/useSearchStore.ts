import { create } from 'zustand';
import { logger } from '../lib/logger';
import { aiSearch } from '../lib/tauri-commands';
import type { ArticleDto, Citation } from '../types';

interface SearchState {
  searchQuery: string;
  searchResults: ArticleDto[];
  aiAnswer: string | null;
  aiCitations: Citation[];
  isSearching: boolean;
  searchMode: boolean;

  setSearchQuery: (query: string) => void;
  executeSearch: () => Promise<void>;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  searchQuery: '',
  searchResults: [],
  aiAnswer: null,
  aiCitations: [],
  isSearching: false,
  searchMode: false,

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
      const result = await aiSearch(q);
      set({
        searchResults: result.localArticles,
        aiAnswer: result.aiAnswer,
        aiCitations: result.citations,
        isSearching: false,
      });
    } catch (e) {
      logger.error({ query: q, error: e }, 'executeSearch failed');
      set({ isSearching: false, searchResults: [], aiAnswer: null, aiCitations: [] });
    }
  },

  clearSearch: () => {
    set({
      searchMode: false,
      searchQuery: '',
      searchResults: [],
      aiAnswer: null,
      aiCitations: [],
    });
  },
}));
