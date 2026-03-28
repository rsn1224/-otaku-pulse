import { defineConfig } from 'vitest/config';

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
      '@tauri-apps/api/core': 'src/test/mocks/tauri.ts',
      '@tauri-apps/plugin-store': 'src/test/mocks/tauri-store.ts',
      '@tauri-apps/plugin-notification': 'src/test/mocks/tauri-notification.ts',
      pino: 'src/test/mocks/pino.ts',
    },
  },
});
