import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://<user>.github.io/rep-record/ on GitHub Pages.
const base = '/rep-record/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // 'prompt' + never calling updateSW: a new version waits until the app is
      // fully closed, so a deploy never reloads the page mid-workout.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Rep Record',
        short_name: 'Rep Record',
        description: 'Plan workouts, log every set, track your body and progress.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#0E0F11',
        theme_color: '#0E0F11',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // woff2: the bundled fonts, so they load with no signal (W-20).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    // Lets palette.test.ts read styles.css as text (?raw) to compare it with the contrast script.
    css: { include: [/styles\.css/] },
  },
});
