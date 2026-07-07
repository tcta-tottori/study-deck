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
      // 表示直後にSWが更新→自動リロードして画面がちらつくのを防ぐ。
      // 新バージョンは待機し、次回の起動時に適用する（読み込み完了後に勝手にリフレッシュしない）。
      registerType: 'prompt',
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
