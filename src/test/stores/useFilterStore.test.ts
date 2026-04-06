import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterStore } from '../../stores/useFilterStore';

const mockedInvoke = vi.mocked(invoke);

describe('useFilterStore', () => {
  beforeEach(() => {
    useFilterStore.setState({
      muteKeywords: [],
      highlightKeywords: [],
    });
  });

  describe('fetchFilters', () => {
    it('separates mute and highlight keywords', async () => {
      mockedInvoke.mockResolvedValueOnce([
        { id: 1, keyword: 'spoiler', filterType: 'mute', category: null, createdAt: '' },
        { id: 2, keyword: 'pokemon', filterType: 'highlight', category: null, createdAt: '' },
        { id: 3, keyword: 'nsfw', filterType: 'mute', category: null, createdAt: '' },
      ]);

      await useFilterStore.getState().fetchFilters();

      const state = useFilterStore.getState();
      expect(state.muteKeywords).toEqual(['spoiler', 'nsfw']);
      expect(state.highlightKeywords).toEqual(['pokemon']);
    });

    it('handles empty filter list', async () => {
      mockedInvoke.mockResolvedValueOnce([]);

      await useFilterStore.getState().fetchFilters();

      const state = useFilterStore.getState();
      expect(state.muteKeywords).toEqual([]);
      expect(state.highlightKeywords).toEqual([]);
    });

    it('does not throw on failure', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('fail'));

      await expect(useFilterStore.getState().fetchFilters()).resolves.toBeUndefined();
      // State should remain unchanged
      expect(useFilterStore.getState().muteKeywords).toEqual([]);
    });
  });
});
