import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { ensureSeeded, migrateThemeBase } from './db/seed'

// PWA Service Worker（vite-plugin-pwa の仮想モジュール）
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

async function bootstrap() {
  try {
    await ensureSeeded()
    await migrateThemeBase()
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
