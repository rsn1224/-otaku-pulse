import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
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
