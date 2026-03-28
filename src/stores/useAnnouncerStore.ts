import { create } from 'zustand';

interface AnnouncerState {
  politeMessage: string;
  assertiveMessage: string;
  announcePolite: (message: string) => void;
  announceAssertive: (message: string) => void;
}

export const useAnnouncerStore = create<AnnouncerState>((set) => ({
  politeMessage: '',
  assertiveMessage: '',
  announcePolite: (message: string) => {
    // 一度クリアしてから再セットすることで、同一メッセージでもスクリーンリーダーが再読み上げする
    set({ politeMessage: '' });
    requestAnimationFrame(() => set({ politeMessage: message }));
  },
  announceAssertive: (message: string) => {
    set({ assertiveMessage: '' });
    requestAnimationFrame(() => set({ assertiveMessage: message }));
  },
}));
