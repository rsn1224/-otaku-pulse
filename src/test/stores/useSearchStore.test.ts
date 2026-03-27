import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useSearchStore } from '../../stores/useSearchStore';

const mockedInvoke = vi.mocked(invoke);

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({
      searchQuery: '',
      searchResults: [],
      aiAnswer: null,
      aiCitations: [],
      isSearching: false,
      searchMode: false,
    });
  });

  describe('setSearchQuery', () => {
    it('updates query string', () => {
      useSearchStore.getState().setSearchQuery('test');
      expect(useSearchStore.getState().searchQuery).toBe('test');
    });

    it('exits search mode when query is cleared', () => {
      useSearchStore.setState({ searchMode: true, searchResults: [{ id: 1 }] as never[] });
      useSearchStore.getState().setSearchQuery('');
      const state = useSearchStore.getState();
      expect(state.searchMode).toBe(false);
      expect(state.searchResults).toEqual([]);
    });

    it('does not exit search mode for non-empty query', () => {
      useSearchStore.setState({ searchMode: true });
      useSearchStore.getState().setSearchQuery('new query');
      expect(useSearchStore.getState().searchMode).toBe(true);
    });
  });

  describe('executeSearch', () => {
    it('does nothing for empty query', async () => {
      useSearchStore.setState({ searchQuery: '   ' });
      await useSearchStore.getState().executeSearch();
      expect(mockedInvoke).not.toHaveBeenCalled();
    });

    it('searches and sets results on success', async () => {
      useSearchStore.setState({ searchQuery: 'anime news' });
      mockedInvoke.mockResolvedValueOnce({
        localArticles: [{ id: 1, title: 'Anime News' }],
        aiAnswer: 'AI says...',
        citations: [{ url: 'https://example.com', title: 'Source' }],
      });

      await useSearchStore.getState().executeSearch();

      const state = useSearchStore.getState();
      expect(state.searchResults).toHaveLength(1);
      expect(state.aiAnswer).toBe('AI says...');
      expect(state.aiCitations).toHaveLength(1);
      expect(state.isSearching).toBe(false);
      expect(state.searchMode).toBe(true);
    });

    it('resets results on failure', async () => {
      useSearchStore.setState({ searchQuery: 'test' });
      mockedInvoke.mockRejectedValueOnce(new Error('network error'));

      await useSearchStore.getState().executeSearch();

      const state = useSearchStore.getState();
      expect(state.isSearching).toBe(false);
      expect(state.searchResults).toEqual([]);
      expect(state.aiAnswer).toBeNull();
    });

    it('invokes ai_search with trimmed query', async () => {
      useSearchStore.setState({ searchQuery: '  pokemon  ' });
      mockedInvoke.mockResolvedValueOnce({
        localArticles: [],
        aiAnswer: null,
        citations: [],
      });

      await useSearchStore.getState().executeSearch();

      expect(mockedInvoke).toHaveBeenCalledWith('ai_search', { query: 'pokemon' });
    });
  });

  describe('clearSearch', () => {
    it('resets all search state', () => {
      useSearchStore.setState({
        searchMode: true,
        searchQuery: 'test',
        searchResults: [{ id: 1 }] as never[],
        aiAnswer: 'answer',
        aiCitations: [{ url: 'u', title: 't' }],
      });

      useSearchStore.getState().clearSearch();

      const state = useSearchStore.getState();
      expect(state.searchMode).toBe(false);
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
      expect(state.aiAnswer).toBeNull();
      expect(state.aiCitations).toEqual([]);
    });
  });
});
