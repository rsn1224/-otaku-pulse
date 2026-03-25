import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type { Category, DigestDto } from '../types';

interface DigestState {
  digests: DigestDto[];
  selectedCategory: Category;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  setSelectedCategory: (category: Category) => void;
  fetchDigests: (category?: Category) => Promise<void>;
  regenerateDigest: (category: Category) => Promise<void>;
}

export const useDigestStore = create<DigestState>()((set) => ({
  digests: [],
  selectedCategory: 'all',
  isLoading: false,
  isGenerating: false,
  error: null,

  setSelectedCategory: (category: Category) => set({ selectedCategory: category }),

  fetchDigests: async (category?: Category) => {
    set({ isLoading: true, error: null });
    try {
      const digests = await invoke<DigestDto[]>('get_digests', { category });
      set({ digests, isLoading: false });
    } catch (error) {
      set({ error: error as string, isLoading: false });
    }
  },

  regenerateDigest: async (category: Category) => {
    set({ isGenerating: true, error: null });
    try {
      const digest = await invoke<DigestDto>('generate_digest', { category });
      set((state) => ({
        digests: [digest, ...state.digests],
        isGenerating: false,
      }));
    } catch (error) {
      set({ error: error as string, isGenerating: false });
    }
  },
}));
