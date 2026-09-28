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
    environment: 'node',
  },
});
