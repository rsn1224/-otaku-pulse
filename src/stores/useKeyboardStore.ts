import { create } from 'zustand';
import { useArticleStore } from './useArticleStore';

interface KeyboardState {
  focusedIndex: number;
  showHelp: boolean;

  setFocusedIndex: (i: number) => void;
  focusNext: () => void;
  focusPrev: () => void;
  toggleHelp: () => void;
}

export const useKeyboardStore = create<KeyboardState>((set, get) => ({
  focusedIndex: -1,
  showHelp: false,

  setFocusedIndex: (i: number) => set({ focusedIndex: i }),

  focusNext: () => {
    const { focusedIndex } = get();
    const articles = useArticleStore.getState().articles;
    if (articles.length === 0) return;
    set({ focusedIndex: Math.min(focusedIndex + 1, articles.length - 1) });
  },

  focusPrev: () => {
    const { focusedIndex } = get();
    set({ focusedIndex: Math.max(focusedIndex - 1, 0) });
  },

  toggleHelp: () => set({ showHelp: !get().showHelp }),
}));
