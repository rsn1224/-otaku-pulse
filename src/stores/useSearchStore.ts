import { create } from 'zustand';
import { logger } from '../lib/logger';
import { aiSearch, semanticSearch } from '../lib/tauri-commands';
import type { ArticleDto, Citation, DiscoverArticleDto } from '../types';

export type SearchKind = 'keyword' | 'semantic';

/** semantic 検索の DiscoverArticleDto を検索結果カード用 ArticleDto に射影する。 */
function toArticleDto(d: DiscoverArticleDto): ArticleDto {
  return {
    id: d.id,
    feedId: d.feedId,
    title: d.title,
    url: d.url,
    summary: d.summary,
    author: d.author,
    publishedAt: d.publishedAt,
    importanceScore: d.totalScore ?? 0,
    isRead: d.isRead,
    isBookmarked: d.isBookmarked,
    language: d.language,
    thumbnailUrl: d.thumbnailUrl,
    feedName: d.feedName,
  };
}

interface SearchState {
  searchQuery: string;
  searchKind: SearchKind;
  searchResults: ArticleDto[];
  aiAnswer: string | null;
  aiCitations: Citation[];
  isSearching: boolean;
  searchMode: boolean;

  setSearchQuery: (query: string) => void;
  setSearchKind: (kind: SearchKind) => void;
  executeSearch: () => Promise<void>;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  searchQuery: '',
  searchKind: 'keyword',
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

  setSearchKind: (kind: SearchKind) => {
    set({ searchKind: kind });
  },

  executeSearch: async () => {
    const { searchQuery, searchKind } = get();
    const q = searchQuery.trim();
    if (!q) return;

    set({ isSearching: true, searchMode: true, aiAnswer: null, aiCitations: [] });
    try {
      if (searchKind === 'semantic') {
        const articles = await semanticSearch(q);
        set({
          searchResults: articles.map(toArticleDto),
          aiAnswer: null,
          aiCitations: [],
          isSearching: false,
        });
      } else {
        const result = await aiSearch(q);
        set({
          searchResults: result.localArticles,
          aiAnswer: result.aiAnswer,
          aiCitations: result.citations,
          isSearching: false,
        });
      }
    } catch (e) {
      logger.error({ query: q, kind: searchKind, error: e }, 'executeSearch failed');
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
