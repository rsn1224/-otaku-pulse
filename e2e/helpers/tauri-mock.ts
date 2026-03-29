import type { Page } from '@playwright/test';

/**
 * Tauri v2 IPC モックヘルパー
 *
 * Playwright の addInitScript でページロード前に注入し、
 * invoke() 呼び出しを捕捉してテスト用のレスポンスを返す。
 *
 * 使い方:
 *   await injectTauriMock(page, {
 *     get_feeds: () => [{ id: 1, name: 'Test Feed' }],
 *     get_articles: () => [],
 *   });
 *   await page.goto('/');
 */
export async function injectTauriMock(
  page: Page,
  handlers: Record<string, ((args: Record<string, unknown>) => unknown) | unknown> = {},
): Promise<void> {
  await page.addInitScript(
    (handlerMap: Record<string, unknown>) => {
      // Tauri v2 の IPC 機構を模倣する
      // transformCallback: コールバック関数を window プロパティとして登録し ID を返す
      const transformCallback = (callback: (result: unknown) => void, once = false): number => {
        const id = Math.floor(Math.random() * 2_147_483_647);
        const prop = `_${id}`;
        Object.defineProperty(window, prop, {
          value: (result: unknown) => {
            if (once) Reflect.deleteProperty(window, prop);
            return callback(result);
          },
          writable: false,
          configurable: true,
        });
        return id;
      };

      // ipc: IPC メッセージを受け取り、ハンドラー結果をコールバックで返す
      const ipc = (message: {
        cmd: string;
        callback: number;
        error: number;
        [key: string]: unknown;
      }) => {
        const { cmd, callback } = message;
        const handler = handlerMap[cmd];

        queueMicrotask(() => {
          try {
            const result =
              typeof handler === 'function'
                ? (handler as (a: Record<string, unknown>) => unknown)(
                    message as Record<string, unknown>,
                  )
                : (handler ?? null);
            (window as unknown as Record<string, (r: unknown) => void>)[`_${callback}`]?.(result);
          } catch (err) {
            const errorProp = `_${message.error}`;
            (window as unknown as Record<string, (e: unknown) => void>)[errorProp]?.(
              err instanceof Error ? err.message : String(err),
            );
          }
        });
      };

      // Tauri v2 のグローバルオブジェクトをモックで上書き
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        transformCallback,
        ipc,
        metadata: {},
      };
    },
    handlers as Record<string, unknown>,
  );
}

/**
 * よく使うコマンドのデフォルトモックセット
 * 空レスポンスを返すので、アプリのローディング・空状態をテストするのに便利
 */
export const DEFAULT_MOCKS = {
  get_feeds: () => [],
  get_articles: () => ({ articles: [], total: 0 }),
  get_settings: () => ({
    theme: 'dark',
    language: 'ja',
    notifications_enabled: true,
  }),
  get_digest_list: () => [],
} as const;
