import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { logger } from '../lib/logger';
import {
  type DigestResult,
  getSchedulerConfig,
  runDigestNow as runDigestNowCmd,
  type SchedulerConfig,
  setSchedulerConfig,
} from '../lib/tauri-commands';

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

interface CollectFailedPayload {
  message: string;
  errorCount: number;
}

interface SchedulerState {
  config: SchedulerConfig;
  lastCollectedAt: string | null;
  lastCollectResult: CollectResult | null;
  collectError: string | null;
  isListening: boolean;
  isOffline: boolean;

  // アクション
  loadConfig: () => Promise<void>;
  saveConfig: (config: SchedulerConfig) => Promise<void>;
  startListening: () => Promise<() => void>;
  runDigestNow: () => Promise<DigestResult[]>;
  setOffline: (offline: boolean) => void;
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
  isOffline: false,

  loadConfig: async () => {
    try {
      const config = await getSchedulerConfig();
      set({ config });
    } catch (error) {
      logger.error({ error }, 'Failed to load scheduler config');
    }
  },

  saveConfig: async (config: SchedulerConfig) => {
    try {
      await setSchedulerConfig(config);
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
        isOffline: false,
      });

      const { useArticleStore } = await import('./useArticleStore');
      useArticleStore.getState().fetchFeed(true);
    });

    const unlistenFailed = await listen<CollectFailedPayload>('collect-failed', (event) => {
      logger.warn({ payload: event.payload }, 'All feeds failed to fetch');
      set({ isOffline: true, collectError: event.payload.message });
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
      unlistenFailed();
      unlistenError();
      unlistenDigest();
      set({ isListening: false });
    };
  },

  setOffline: (offline: boolean) => {
    set({ isOffline: offline });
  },

  runDigestNow: async () => {
    try {
      const results = await runDigestNowCmd();

      // 各結果を個別にdigest-readyイベントとして処理
      // ダイジェスト結果はイベント経由で通知済み

      return results;
    } catch (error) {
      logger.error({ error }, 'Failed to run digest now');
      throw error;
    }
  },
}));
