import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { ensureSeeded, migrateThemeBase, migrateCategories } from './db/seed'

// PWA Service Worker（vite-plugin-pwa の仮想モジュール）
// autoUpdate 運用：新バージョンを検知したら自動で有効化し、最新を確実に配信する。
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

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
