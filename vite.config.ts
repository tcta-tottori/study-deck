import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages: served from https://<user>.github.io/study-deck/
export default defineConfig({
  base: '/study-deck/',
  // ビルド時刻を埋め込み（設定画面で「最終更新」として表示・デプロイ確認用）
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // 新バージョンを確実に配信するため autoUpdate（skipWaiting + clientsClaim）。
      // prompt にすると新SWが待機したまま有効化されず、旧キャッシュで固定され
      // 「最新版が反映されない」問題が起きるため、自動更新を優先する。
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'StudyDrill',
        short_name: 'StudyDrill',
        description: '苦手優先で高速反復。スキマ時間で合格ラインへ。',
        theme_color: '#2b2f86',
        background_color: '#2b2f86',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/study-deck/',
        scope: '/study-deck/',
        lang: 'ja',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}'],
        navigateFallback: '/study-deck/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
