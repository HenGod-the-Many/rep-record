import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://<user>.github.io/workout-journal/ on GitHub Pages.
const base = '/workout-journal/';

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
        name: 'Workout Journal',
        short_name: 'Workouts',
        description: 'Plan workouts, log every set, keep a journal.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#111418',
        theme_color: '#111418',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
});
