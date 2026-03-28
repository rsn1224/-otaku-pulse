import type React from 'react';
import { useEffect } from 'react';
import { ToastProvider, useToast } from './components/common/Toast';
import { AppShell } from './components/layout/AppShell';
import { Announcer } from './hooks/useAnnouncer';
import { logger } from './lib/logger';
import { useSchedulerStore } from './stores/useSchedulerStore';

function AppContent(): React.JSX.Element {
  const { startListening } = useSchedulerStore();
  const { showToast } = useToast();

  useEffect(() => {
    // アプリ起動時に一度だけイベントリスナーを開始
    const setupListener = async () => {
      try {
        const unlisten = await startListening();
        return unlisten;
      } catch (error) {
        logger.error({ error }, 'Failed to start scheduler listener');
        return () => {};
      }
    };

    const cleanup = setupListener();
    return () => {
      cleanup
        .then((unlisten) => unlisten())
        .catch((e) => logger.warn({ error: e }, 'Cleanup failed'));
    };
  }, [startListening]);

  useEffect(() => {
    // スケジューラーイベントリスナーを設定
    const setupSchedulerEvents = async () => {
      const { listen } = await import('@tauri-apps/api/event');

      // 収集完了イベント
      const unlistenCollect = await listen<{ fetched: number; saved: number }>(
        'collect-completed',
        (event) => {
          if (event.payload.saved > 0) {
            showToast('success', `${event.payload.saved}件の新着記事を取得しました`);
          }
        },
      );

      // 収集エラーイベント
      const unlistenError = await listen<string>('collect-error', (event) => {
        showToast('error', `収集エラー: ${event.payload}`, 5000);
      });

      // ダイジェスト準備完了イベント
      const unlistenDigest = await listen<{ category: string }>('digest-ready', (event) => {
        showToast('success', `${event.payload.category}ダイジェストを更新しました`);
      });

      return () => {
        unlistenCollect();
        unlistenError();
        unlistenDigest();
      };
    };

    const cleanup = setupSchedulerEvents();
    return () => {
      cleanup
        .then((unlisten) => unlisten())
        .catch((e) => logger.warn({ error: e }, 'Cleanup failed'));
    };
  }, [showToast]);

  // マイルストーン祝福
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setup = async (): Promise<void> => {
      const { listen } = await import('@tauri-apps/api/event');
      const { invoke } = await import('@tauri-apps/api/core');

      unlistenFn = await listen('collect-completed', async () => {
        try {
          const p = await invoke<{ totalRead: number }>('get_user_profile');
          const milestones: Record<number, string> = {
            10: '10 記事読了！ いい調子です',
            50: '50 記事！ あなたの好みを学習しました',
            100: '100 記事達成！ エキスパートですね',
            500: '500 記事！ 真のオタクです',
          };
          const msg = milestones[p.totalRead];
          if (msg) showToast('success', msg, 5000);
        } catch (e) {
          logger.debug({ error: e }, 'milestone check failed');
        }
      });
    };

    setup();
    return () => {
      unlistenFn?.();
    };
  }, [showToast]);

  return <AppShell />;
}

function App(): React.JSX.Element {
  return (
    <>
      <a href="#main-content" className="skip-link">
        メインコンテンツへスキップ
      </a>
      <Announcer />
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </>
  );
}

export default App;
