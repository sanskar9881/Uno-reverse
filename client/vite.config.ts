import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Party Night',
        short_name: 'Party Night',
        description: 'UNO, Spin the Bottle, Name Wheel and Couples Truth or Dare, together or online.',
        theme_color: '#151028',
        background_color: '#151028',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The socket server and stats API live on a different origin/port and are never
        // precached or intercepted; only the built app shell is, so the one-phone games
        // (Name Wheel, one-phone Spin the Bottle, Together-mode Couples) work offline.
        globPatterns: ['**/*.{js,css,html,woff,woff2,svg,png,ico}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
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
