import { create } from 'zustand';
import type { WingId } from '../types';

interface AppState {
  activeWing: WingId;
  sidebarCollapsed: boolean;
  setActiveWing: (wing: WingId) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()((set) => ({
  activeWing: 'dashboard',
  sidebarCollapsed: false,
  setActiveWing: (wing) => set({ activeWing: wing }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
