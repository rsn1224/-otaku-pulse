import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { logger } from '../lib/logger';
import type { UserProfileDto } from '../types';

interface ProfileState {
  profile: UserProfileDto | null;
  isLoading: boolean;
  error: string | null;

  fetchProfile: () => Promise<void>;
  updateProfile: (profile: UserProfileDto) => Promise<void>;
  resetLearningData: () => Promise<void>;
}

const DEFAULT_PROFILE: UserProfileDto = {
  displayName: 'オタク',
  favoriteTitles: [],
  favoriteGenres: [],
  favoriteCreators: [],
  totalRead: 0,
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: DEFAULT_PROFILE,
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await invoke<UserProfileDto>('get_user_profile');
      set({ profile, isLoading: false });
    } catch (e) {
      logger.error({ error: e }, 'fetchProfile failed');
      set({
        error: 'プロフィールの取得に失敗しました',
        isLoading: false,
        profile: DEFAULT_PROFILE,
      });
    }
  },

  updateProfile: async (profile: UserProfileDto) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('update_user_profile', { profile });
      set({ profile, isLoading: false });
    } catch (e) {
      logger.error({ error: e }, 'updateProfile failed');
      set({ error: 'プロフィールの更新に失敗しました', isLoading: false });
    }
  },

  resetLearningData: async () => {
    try {
      await invoke('reset_learning_data');
      const profile = await invoke<UserProfileDto>('get_user_profile');
      set({ profile });
    } catch (e) {
      logger.error({ error: e }, 'resetLearningData failed');
      set({ error: 'リセットに失敗しました' });
    }
  },
}));
