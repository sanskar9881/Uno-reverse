import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@shared$/, replacement: fileURLToPath(new URL('../shared/index.ts', import.meta.url)) },
      { find: /^@shared\//, replacement: `${fileURLToPath(new URL('../shared/', import.meta.url))}` },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    env: { LOG_LEVEL: 'error' },
    testTimeout: 20_000,
  },
});
