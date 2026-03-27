import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileStore } from '../../stores/useProfileStore';
import type { UserProfileDto } from '../../types';

const mockedInvoke = vi.mocked(invoke);

const DEFAULT_PROFILE: UserProfileDto = {
  displayName: 'オタク',
  favoriteTitles: [],
  favoriteGenres: [],
  favoriteCreators: [],
  totalRead: 0,
};

describe('useProfileStore', () => {
  beforeEach(() => {
    useProfileStore.setState({
      profile: DEFAULT_PROFILE,
      isLoading: false,
      error: null,
    });
  });

  describe('fetchProfile', () => {
    it('fetches profile from backend', async () => {
      const mockProfile: UserProfileDto = {
        displayName: 'テストユーザー',
        favoriteTitles: ['進撃の巨人'],
        favoriteGenres: ['アクション'],
        favoriteCreators: ['諫山創'],
        totalRead: 42,
      };
      mockedInvoke.mockResolvedValueOnce(mockProfile);

      await useProfileStore.getState().fetchProfile();

      expect(mockedInvoke).toHaveBeenCalledWith('get_user_profile');
      const state = useProfileStore.getState();
      expect(state.profile).toEqual(mockProfile);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error and default profile on failure', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('network error'));

      await useProfileStore.getState().fetchProfile();

      const state = useProfileStore.getState();
      expect(state.error).toBe('プロフィールの取得に失敗しました');
      expect(state.isLoading).toBe(false);
      expect(state.profile).toEqual(DEFAULT_PROFILE);
    });
  });

  describe('updateProfile', () => {
    it('updates profile via backend', async () => {
      const updatedProfile: UserProfileDto = {
        displayName: '新しい名前',
        favoriteTitles: ['ワンピース'],
        favoriteGenres: ['冒険'],
        favoriteCreators: ['尾田栄一郎'],
        totalRead: 100,
      };
      mockedInvoke.mockResolvedValueOnce(undefined);

      await useProfileStore.getState().updateProfile(updatedProfile);

      expect(mockedInvoke).toHaveBeenCalledWith('update_user_profile', {
        profile: updatedProfile,
      });
      const state = useProfileStore.getState();
      expect(state.profile).toEqual(updatedProfile);
      expect(state.isLoading).toBe(false);
    });

    it('sets error on failure without changing profile', async () => {
      const originalProfile: UserProfileDto = {
        displayName: 'オタク',
        favoriteTitles: ['鬼滅の刃'],
        favoriteGenres: [],
        favoriteCreators: [],
        totalRead: 10,
      };
      useProfileStore.setState({ profile: originalProfile });
      mockedInvoke.mockRejectedValueOnce(new Error('save error'));

      await useProfileStore.getState().updateProfile({
        ...originalProfile,
        displayName: '変更',
      });

      const state = useProfileStore.getState();
      expect(state.error).toBe('プロフィールの更新に失敗しました');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('resetLearningData', () => {
    it('resets learning data and refetches profile', async () => {
      const freshProfile: UserProfileDto = {
        displayName: 'オタク',
        favoriteTitles: [],
        favoriteGenres: [],
        favoriteCreators: [],
        totalRead: 0,
      };
      mockedInvoke.mockResolvedValueOnce(undefined); // reset_learning_data
      mockedInvoke.mockResolvedValueOnce(freshProfile); // get_user_profile

      await useProfileStore.getState().resetLearningData();

      expect(mockedInvoke).toHaveBeenCalledWith('reset_learning_data');
      expect(mockedInvoke).toHaveBeenCalledWith('get_user_profile');
      expect(useProfileStore.getState().profile).toEqual(freshProfile);
    });

    it('sets error on failure', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('reset failed'));

      await useProfileStore.getState().resetLearningData();

      expect(useProfileStore.getState().error).toBe('リセットに失敗しました');
    });
  });
});
