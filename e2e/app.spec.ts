import { expect, test } from '@playwright/test';
import { DEFAULT_MOCKS, injectTauriMock } from './helpers/tauri-mock';

test.describe('App — スモークテスト', () => {
  test.beforeEach(async ({ page }) => {
    await injectTauriMock(page, DEFAULT_MOCKS);
  });

  test('アプリが正常にロードされる', async ({ page }) => {
    await page.goto('/');

    // React がマウントされるまで待つ
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('ページタイトルが設定されている', async ({ page }) => {
    await page.goto('/');
    // Tauri アプリのタイトルを確認（空文字でないこと）
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('JavaScript エラーが発生しない', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    // コンポーネントが落ち着くまで少し待つ
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });

  test('コンソールに error ログが出ない', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(500);

    // Tauri 関連の既知の警告は除外する
    const filteredErrors = consoleErrors.filter(
      (e) => !e.includes('__TAURI_INTERNALS__') && !e.includes('tauri://'),
    );
    expect(filteredErrors).toHaveLength(0);
  });
});
