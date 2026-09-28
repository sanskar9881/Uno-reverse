import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@shared$/, replacement: fileURLToPath(new URL('../shared/index.ts', import.meta.url)) },
      { find: /^@shared\//, replacement: `${fileURLToPath(new URL('../shared/', import.meta.url))}` },
    ],
  },
  server: {
    host: true, // reachable from phones on the same Wi-Fi
    port: 5173,
    fs: { allow: ['..'] }, // the shared/ folder lives outside client/
  },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache well between deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
          if (/[\\/](socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io)[\\/]/.test(id)) return 'realtime';
          return 'vendor';
        },
      },
    },
  },
});
