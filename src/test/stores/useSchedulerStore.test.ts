import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSchedulerStore } from '../../stores/useSchedulerStore';

const mockedInvoke = vi.mocked(invoke);

describe('useSchedulerStore', () => {
  beforeEach(() => {
    useSchedulerStore.setState({
      config: {
        collect_interval_minutes: 60,
        digest_hour: 8,
        digest_minute: 0,
        enabled: true,
      },
      lastCollectedAt: null,
      lastCollectResult: null,
      collectError: null,
      isListening: false,
    });
  });

  describe('loadConfig', () => {
    it('fetches config from backend and updates store', async () => {
      const mockConfig = {
        collect_interval_minutes: 30,
        digest_hour: 10,
        digest_minute: 30,
        enabled: false,
      };
      mockedInvoke.mockResolvedValueOnce(mockConfig);

      await useSchedulerStore.getState().loadConfig();

      expect(mockedInvoke).toHaveBeenCalledWith('get_scheduler_config');
      expect(useSchedulerStore.getState().config).toEqual(mockConfig);
    });

    it('keeps default config on error', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('store read failed'));

      await useSchedulerStore.getState().loadConfig();

      const state = useSchedulerStore.getState();
      expect(state.config.collect_interval_minutes).toBe(60);
      expect(state.config.enabled).toBe(true);
    });
  });

  describe('saveConfig', () => {
    it('saves config to backend and updates store', async () => {
      const newConfig = {
        collect_interval_minutes: 120,
        digest_hour: 6,
        digest_minute: 0,
        enabled: true,
      };
      mockedInvoke.mockResolvedValueOnce(undefined);

      await useSchedulerStore.getState().saveConfig(newConfig);

      expect(mockedInvoke).toHaveBeenCalledWith('set_scheduler_config', { config: newConfig });
      expect(useSchedulerStore.getState().config).toEqual(newConfig);
    });

    it('throws error on failure', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('save failed'));

      await expect(
        useSchedulerStore.getState().saveConfig({
          collect_interval_minutes: 30,
          digest_hour: 8,
          digest_minute: 0,
          enabled: true,
        }),
      ).rejects.toThrow('save failed');
    });
  });

  describe('runDigestNow', () => {
    it('invokes run_digest_now and returns results', async () => {
      const mockResults = [
        {
          category: 'anime',
          result: { category: 'anime', summary: 'test', article_count: 5 },
        },
      ];
      mockedInvoke.mockResolvedValueOnce(mockResults);

      const results = await useSchedulerStore.getState().runDigestNow();

      expect(mockedInvoke).toHaveBeenCalledWith('run_digest_now');
      expect(results).toEqual(mockResults);
    });

    it('throws error on failure', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('digest failed'));

      await expect(useSchedulerStore.getState().runDigestNow()).rejects.toThrow('digest failed');
    });
  });
});
