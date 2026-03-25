import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';

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
      console.error('Failed to load scheduler config:', error);
    }
  },

  saveConfig: async (config: SchedulerConfig) => {
    try {
      await invoke('set_scheduler_config', { config });
      set({ config });
    } catch (error) {
      console.error('Failed to save scheduler config:', error);
      throw error;
    }
  },

  startListening: async () => {
    const unlistenCollect = await listen<CollectResult>('collect-completed', async (event) => {
      console.log('Collect completed:', event.payload);
      set({
        lastCollectedAt: new Date().toISOString(),
        lastCollectResult: event.payload,
        collectError: null,
      });

      // 記事ストアを更新
      const { useArticleStore } = await import('./useArticleStore');
      useArticleStore.getState().fetchArticles(true);
    });

    const unlistenError = await listen<string>('collect-error', (event) => {
      console.error('Collect error:', event.payload);
      set({ collectError: event.payload });
    });

    const unlistenDigest = await listen<DigestReadyPayload>('digest-ready', async (event) => {
      console.log('Digest ready:', event.payload);

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
      console.error('Failed to run digest now:', error);
      throw error;
    }
  },
}));
