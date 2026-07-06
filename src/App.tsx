import { useEffect, useState, useCallback } from 'react'
import { useSettings } from './hooks/useAppData'
import Home from './screens/Home'
import Quiz, { type QuizConfig } from './screens/Quiz'
import Exam from './screens/Exam'
import Dashboard from './screens/Dashboard'
import ImportScreen from './screens/Import'
import Settings from './screens/Settings'
import Toast, { ToastCtx, useToastState } from './components/Toast'
import { scheduleDailyReminder } from './lib/reminder'
import { Icon, type IconName } from './components/Icon'

export type View = 'home' | 'quiz' | 'exam' | 'dashboard' | 'import' | 'settings'

function applyTheme(mode: 'auto' | 'light' | 'dark') {
  const root = document.documentElement
  let resolved = mode
  if (mode === 'auto') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  root.setAttribute('data-theme', resolved)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a1122' : '#f7f9fd')
}

export default function App() {
  const settings = useSettings()
  const [view, setView] = useState<View>('home')
  const [quizConfig, setQuizConfig] = useState<QuizConfig>({})
  const toast = useToastState()

  // テーマ適用（設定 + システム変更を追従）
  useEffect(() => {
    const mode = settings?.theme ?? 'auto'
    applyTheme(mode)
    if (mode !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('auto')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings?.theme])

  // 毎日リマインド（通知 or アプリ内バナーへフォールバック）
  useEffect(() => {
    const time = settings?.reminderTime
    if (!time) return
    const cleanup = scheduleDailyReminder(time, () =>
      toast.show('⏰ 今日の学習はお済みですか？1問だけでも回しましょう。'),
    )
    return cleanup
  }, [settings?.reminderTime, toast])

  const startQuiz = useCallback((cfg: QuizConfig) => {
    setQuizConfig(cfg)
    setView('quiz')
  }, [])

  const go = useCallback((v: View) => setView(v), [])

  const landscape = !!settings?.landscape

  return (
    <ToastCtx.Provider value={toast.show}>
      <div className={`rot${landscape ? ' rot-on' : ''}`}>
        <div className="app">
        {view === 'home' && <Home onStartQuiz={startQuiz} go={go} />}
        {view === 'quiz' && <Quiz config={quizConfig} onExit={() => setView('home')} />}
        {view === 'exam' && <Exam onExit={() => setView('home')} />}
        {view === 'dashboard' && <Dashboard />}
        {view === 'import' && <ImportScreen />}
        {view === 'settings' && <Settings onBack={() => setView('home')} />}

        {view !== 'quiz' && view !== 'exam' && (
          <nav className="nav">
            <NavBtn label="ホーム" icon="home" active={view === 'home'} onClick={() => go('home')} />
            <NavBtn label="学習" icon="bolt" active={false} onClick={() => startQuiz({})} />
            <NavBtn label="成績" icon="chart" active={view === 'dashboard'} onClick={() => go('dashboard')} />
            <NavBtn label="取込" icon="import" active={view === 'import'} onClick={() => go('import')} />
            <NavBtn label="設定" icon="gear" active={view === 'settings'} onClick={() => go('settings')} />
          </nav>
        )}

        {toast.node && <Toast>{toast.node}</Toast>}
        </div>
      </div>
    </ToastCtx.Provider>
  )
}

function NavBtn({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: IconName
  active: boolean
  onClick: () => void
}) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      <span className="ic">
        <Icon name={icon} size={22} strokeWidth={active ? 2 : 1.8} />
      </span>
      {label}
    </button>
  )
}
