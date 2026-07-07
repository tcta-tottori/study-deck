import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { ensureSeeded, migrateThemeBase, migrateCategories } from './db/seed'

// PWA Service Worker（vite-plugin-pwa の仮想モジュール）
// prompt 運用：更新があっても表示中に自動リロードせず、次回起動時に新版を適用する。
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
