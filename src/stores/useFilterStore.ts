import { create } from 'zustand';
import { logger } from '../lib/logger';
import { getKeywordFilters } from '../lib/tauri-commands';

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
      const filters = await getKeywordFilters();
      set({
        muteKeywords: filters.filter((f) => f.filterType === 'mute').map((f) => f.keyword),
        highlightKeywords: filters
          .filter((f) => f.filterType === 'highlight')
          .map((f) => f.keyword),
      });
    } catch (e) {
      logger.error({ error: e }, 'fetchFilters failed');
    }
  },
}));
