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
      // We register the service worker ourselves in src/pwa.ts (via the `virtual:pwa-register`
      // module) so we can poll for updates on a long-lived tab; injecting a second registration
      // here would race it.
      injectRegister: false,
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
        // Fonts are deliberately left out of the precache (see the runtimeCaching entry below):
        // @fontsource-variable ships every script's subset (Latin, Latin Extended, Vietnamese,
        // Devanagari, ...) as separate woff2 files selected by unicode-range, and precaching
        // them all would download subsets most installs never render. Only the app shell
        // (JS/CSS/HTML/icons) is precached, which is enough for the one-phone games (Name
        // Wheel, one-phone Spin the Bottle, Together-mode Couples) to work fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        // The server now serves this client too, so the API and Socket.IO ARE same-origin —
        // navigateFallback matches by path, not origin, so this keeps the service worker from
        // ever treating an /api or /socket.io request as a client-side route needing index.html.
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        runtimeCaching: [
          {
            // Never cache the game server: a stale room list or a cached socket handshake
            // response would be actively wrong, not just outdated.
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/'),
            handler: 'NetworkOnly',
          },
          {
            // Fonts are cached the first time they're actually used (e.g. the Devanagari
            // subset only after a Hindi nickname renders), not precached, and then reused
            // offline from then on. They're immutable (hashed filenames), so CacheFirst is safe.
            urlPattern: ({ request }: { request: Request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
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
