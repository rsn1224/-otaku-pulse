import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    environmentMatchGlobs: [
      ['src/test/hooks/**', 'jsdom'],
      ['src/test/components/**', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/vite-env.d.ts', 'src/main.tsx'],
    },
  },
  resolve: {
    alias: {
      '@tauri-apps/api/core': r('src/test/mocks/tauri.ts'),
      '@tauri-apps/plugin-store': r('src/test/mocks/tauri-store.ts'),
      '@tauri-apps/plugin-notification': r('src/test/mocks/tauri-notification.ts'),
      '@tauri-apps/plugin-opener': r('src/test/mocks/tauri-opener.ts'),
      pino: r('src/test/mocks/pino.ts'),
    },
  },
});
