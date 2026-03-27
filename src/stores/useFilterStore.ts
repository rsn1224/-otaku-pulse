import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { logger } from '../lib/logger';

interface KeywordFilterDto {
  id: number;
  keyword: string;
  filter_type: string;
  category: string | null;
  created_at: string;
}

interface FilterState {
  muteKeywords: string[];
  highlightKeywords: string[];
  fetchFilters: () => Promise<void>;
}

export const useFilterStore = create<FilterState>((set) => ({
  muteKeywords: [],
  highlightKeywords: [],

  fetchFilters: async () => {
    try {
      const filters = await invoke<KeywordFilterDto[]>('get_keyword_filters');
      set({
        muteKeywords: filters.filter((f) => f.filter_type === 'mute').map((f) => f.keyword),
        highlightKeywords: filters
          .filter((f) => f.filter_type === 'highlight')
          .map((f) => f.keyword),
      });
    } catch (e) {
      logger.error({ error: e }, 'fetchFilters failed');
    }
  },
}));
