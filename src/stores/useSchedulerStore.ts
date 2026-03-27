import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { logger } from '../lib/logger';

interface SchedulerConfig {
  collect_interval_minutes: number;
  digest_hour: number;
  digest_minute: number;
  enabled: boolean;
}

interface CollectResult {
  fetched: number;
  saved: number;
}

interface DigestReadyPayload {
  category: string;
  result: {
    category: string;
    summary: string;
    article_count: number;
    generated_at: string;
    is_ai_generated: boolean;
    provider?: string;
    model?: string;
    fallback_reason?: string;
  };
}

interface SchedulerState {
  config: SchedulerConfig;
  lastCollectedAt: string | null;
  lastCollectResult: CollectResult | null;
  collectError: string | null;
  isListening: boolean;

  // アクション
  loadConfig: () => Promise<void>;
  saveConfig: (config: SchedulerConfig) => Promise<void>;
  startListening: () => Promise<() => void>;
  runDigestNow: () => Promise<DigestReadyPayload[]>;
}

export const useSchedulerStore = create<SchedulerState>((set) => ({
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

  loadConfig: async () => {
    try {
      const config = await invoke<SchedulerConfig>('get_scheduler_config');
      set({ config });
    } catch (error) {
      logger.error({ error }, 'Failed to load scheduler config');
    }
  },

  saveConfig: async (config: SchedulerConfig) => {
    try {
      await invoke('set_scheduler_config', { config });
      set({ config });
    } catch (error) {
      logger.error({ error }, 'Failed to save scheduler config');
      throw error;
    }
  },

  startListening: async () => {
    const unlistenCollect = await listen<CollectResult>('collect-completed', async (event) => {
      set({
        lastCollectedAt: new Date().toISOString(),
        lastCollectResult: event.payload,
        collectError: null,
      });

      const { useArticleStore } = await import('./useArticleStore');
      useArticleStore.getState().fetchFeed(true);
    });

    const unlistenError = await listen<string>('collect-error', (event) => {
      logger.error({ payload: event.payload }, 'Collect error');
      set({ collectError: event.payload });
    });

    const unlistenDigest = await listen<DigestReadyPayload>('digest-ready', async (_event) => {
      // ダイジェスト完了（ストア更新は DigestWing 側の useEffect で自動再取得）
    });

    set({ isListening: true });

    // アンリスン関数を返す（コンポーネントのクリーンアップ用）
    return () => {
      unlistenCollect();
      unlistenError();
      unlistenDigest();
      set({ isListening: false });
    };
  },

  runDigestNow: async () => {
    try {
      const results = await invoke<DigestReadyPayload[]>('run_digest_now');

      // 各結果を個別にdigest-readyイベントとして処理
      // ダイジェスト結果はイベント経由で通知済み

      return results;
    } catch (error) {
      logger.error({ error }, 'Failed to run digest now');
      throw error;
    }
  },
}));
