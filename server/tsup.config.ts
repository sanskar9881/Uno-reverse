import { defineConfig } from 'tsup';

// Bundles src + ../shared into a single ESM file; npm dependencies stay external.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
});
