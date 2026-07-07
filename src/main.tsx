import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { ensureSeeded, migrateThemeBase, migrateCategories } from './db/seed'

// PWA Service Worker（vite-plugin-pwa の仮想モジュール）
// autoUpdate 運用：新バージョンを検知したら自動で有効化し、最新を確実に配信する。
// 更新時はまもなくページが自動リロードされるため、その直前に App へ通知して
// 起動ローダーを出したままにし、「アプリ→再ローディング（Loadingが2回）」を防ぐ。
import { registerSW } from 'virtual:pwa-register'
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    registration.addEventListener('updatefound', () => {
      // すでにSWに制御されている＝バージョン更新（初回インストールは除外）。
      if (navigator.serviceWorker?.controller) {
        ;(window as unknown as { __swUpdating?: boolean }).__swUpdating = true
        window.dispatchEvent(new Event('sw-updating'))
      }
    })
  },
})

async function bootstrap() {
  try {
    await ensureSeeded()
    await migrateThemeBase()
    await migrateCategories()
  } catch (e) {
    // seed 失敗でもアプリは起動させる
    console.error('seed failed', e)
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()
