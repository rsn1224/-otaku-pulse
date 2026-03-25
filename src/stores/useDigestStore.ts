import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';

interface DigestResult {
  category: string;
  summary: string;
  article_count: number;
  generated_at: string;
  is_ai_generated: boolean;
}

interface DigestState {
  digests: Record<string, DigestResult>;
  isGenerating: boolean;
  error: string | null;
  generateDigest: (category: string) => Promise<void>;
  clearError: () => void;
}

export const useDigestStore = create<DigestState>((set) => ({
  digests: {},
  isGenerating: false,
  error: null,

  generateDigest: async (category: string) => {
    set({ isGenerating: true, error: null });

    try {
      const result: DigestResult = await invoke('generate_digest', {
        category,
        hours: 24,
      });

      set((state) => ({
        digests: { ...state.digests, [category]: result },
        isGenerating: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to generate digest',
        isGenerating: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
