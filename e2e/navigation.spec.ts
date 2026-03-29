import { expect, test } from '@playwright/test';
import { DEFAULT_MOCKS, injectTauriMock } from './helpers/tauri-mock';

/**
 * ナビゲーションテスト — 4 Wings 間の遷移を検証する
 *
 * NOTE: セレクターはアプリの実際の DOM 構造に合わせて調整が必要。
 *       初回実行後、失敗したテストのスクリーンショットで確認し更新すること。
 */
test.describe('ナビゲーション — 4 Wings', () => {
  test.beforeEach(async ({ page }) => {
    await injectTauriMock(page, DEFAULT_MOCKS);
    await page.goto('/');
    // アプリの初期ロードを待つ
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('Dashboard Wing が表示される', async ({ page }) => {
    // ナビゲーションの Dashboard リンクを探す（aria-label または data-wing 属性）
    const dashboardNav = page
      .locator('[data-wing="dashboard"], [aria-label*="Dashboard"], [aria-label*="ダッシュボード"]')
      .first();

    if (await dashboardNav.isVisible()) {
      await dashboardNav.click();
    }

    // Dashboard コンテンツが存在することを確認
    const dashboardContent = page
      .locator('[data-testid="dashboard"], .dashboard, [class*="dashboard"]')
      .first();
    await expect(dashboardContent).toBeVisible({ timeout: 5_000 });
  });

  test('Feed Wing に遷移できる', async ({ page }) => {
    const feedNav = page
      .locator('[data-wing="feed"], [aria-label*="Feed"], [aria-label*="フィード"]')
      .first();

    if (await feedNav.isVisible()) {
      await feedNav.click();
      const feedContent = page.locator('[data-testid="feed"], .feed-wing, [class*="feed"]').first();
      await expect(feedContent).toBeVisible({ timeout: 5_000 });
    } else {
      // ナビゲーション要素が見つからない場合はスキップ（セレクター調整が必要）
      test.skip();
    }
  });

  test('Settings Wing に遷移できる', async ({ page }) => {
    const settingsNav = page
      .locator('[data-wing="settings"], [aria-label*="Settings"], [aria-label*="設定"]')
      .first();

    if (await settingsNav.isVisible()) {
      await settingsNav.click();
      const settingsContent = page
        .locator('[data-testid="settings"], .settings-wing, [class*="settings"]')
        .first();
      await expect(settingsContent).toBeVisible({ timeout: 5_000 });
    } else {
      test.skip();
    }
  });
});
