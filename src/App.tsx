import { useEffect, useState, useCallback } from 'react'
import { useSettings, useQuestions, useRecordsMap, useActivity } from './hooks/useAppData'
import { updateSettings } from './db/db'
import Home from './screens/Home'
import Quiz, { type QuizConfig } from './screens/Quiz'
import Exam from './screens/Exam'
import Dashboard from './screens/Dashboard'
import ImportScreen from './screens/Import'
import Settings from './screens/Settings'
import Toast, { ToastCtx, useToastState } from './components/Toast'
import Loading from './components/Loading'
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
  // データ取得は App 側に集約（画面遷移で再取得＝数値が一瞬0になるちらつきを防ぐ）
  const questions = useQuestions()
  const records = useRecordsMap()
  const activity = useActivity()
  const [view, setView] = useState<View>('home')
  const [quizConfig, setQuizConfig] = useState<QuizConfig>({})
  const toast = useToastState()
  // 横画面は即時反映のためローカル状態で持ち、設定にも保存
  const [landscape, setLandscapeState] = useState(false)
  // ローディングのタイムアウト保険（詰まっても数秒でアプリ表示へ）
  const [bailout, setBailout] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setBailout(true), 6000)
    return () => clearTimeout(t)
  }, [])

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

  // 設定側の landscape 値をローカルへ同期（他タブ/初回ロード反映）
  useEffect(() => {
    setLandscapeState(!!settings?.landscape)
  }, [settings?.landscape])

  const setLandscape = useCallback((v: boolean) => {
    setLandscapeState(v) // 画面は即座に切替
    void updateSettings({ landscape: v }) // 永続化は非同期で追随
  }, [])

  const startQuiz = useCallback((cfg: QuizConfig) => {
    setQuizConfig(cfg)
    setView('quiz')
  }, [])

  const go = useCallback((v: View) => setView(v), [])

  // 初期データが揃うまではローディング表示（数値の0ちらつき防止）。
  // 万一データ取得が詰まっても数秒でアプリ表示へ移行し、無限ローディングを防ぐ。
  const ready = questions !== undefined && records !== undefined && activity !== undefined
  if (!ready && !bailout) return <Loading />
  const safeQuestions = questions ?? []
  const safeRecords = records ?? new Map()
  const safeActivity = activity ?? []

  return (
    <ToastCtx.Provider value={toast.show}>
      <div className={`rot${landscape ? ' rot-on' : ''}`}>
        <div className="app">
        {view === 'home' && (
          <Home
            onStartQuiz={startQuiz}
            go={go}
            settings={settings}
            questions={safeQuestions}
            records={safeRecords}
            activity={safeActivity}
            landscape={landscape}
            setLandscape={setLandscape}
          />
        )}
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
