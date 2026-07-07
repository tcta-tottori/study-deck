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

const NAV_ITEMS: { view: View; label: string; icon: IconName }[] = [
  { view: 'home', label: 'ホーム', icon: 'home' },
  { view: 'dashboard', label: '成績', icon: 'chart' },
  { view: 'import', label: '取込', icon: 'import' },
  { view: 'settings', label: '設定', icon: 'gear' },
]

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
  // PC相当のワイド画面か（メディアクエリを追従）。横画面トグルONでも「ワイド扱い」にする。
  const [pcWidth, setPcWidth] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 860px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 860px)')
    const h = () => setPcWidth(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  // 縦画面の下メニュー（ハンバーガー）の開閉
  const [menuOpen, setMenuOpen] = useState(false)
  // ローディングのタイムアウト保険（詰まっても数秒でアプリ表示へ）
  const [bailout, setBailout] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setBailout(true), 6000)
    return () => clearTimeout(t)
  }, [])
  // 読込画面は最低1秒は表示（一瞬で消えるチラつきを防ぐ）
  const [minShown, setMinShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMinShown(true), 1000)
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

  // ワイド（PC/横画面）= サイドバー表示。それ以外（縦画面スマホ）= ハンバーガー。
  const wide = landscape || pcWidth
  // 画面遷移・レイアウト変化でハンバーガーメニューは閉じる
  useEffect(() => {
    setMenuOpen(false)
  }, [view, wide])

  // 初期データが揃い、かつ最低表示時間（1秒）を満たすまではローディング表示
  // （数値の0ちらつき・読込画面の一瞬消えを防ぐ）。
  // 万一データ取得が詰まっても数秒でアプリ表示へ移行し、無限ローディングを防ぐ。
  const ready = questions !== undefined && records !== undefined && activity !== undefined
  if ((!ready || !minShown) && !bailout) return <Loading />
  const safeQuestions = questions ?? []
  const safeRecords = records ?? new Map()
  const safeActivity = activity ?? []

  const showChrome = view !== 'quiz' && view !== 'exam'

  return (
    <ToastCtx.Provider value={toast.show}>
      <div className={`rot${landscape ? ' rot-on' : ''}`}>
        <div className={`app${wide ? ' wide' : ''}`}>
        {view === 'home' && (
          <Home
            onStartQuiz={startQuiz}
            go={go}
            settings={settings}
            questions={safeQuestions}
            records={safeRecords}
            activity={safeActivity}
          />
        )}
        {view === 'quiz' && <Quiz config={quizConfig} onExit={() => setView('home')} />}
        {view === 'exam' && <Exam onExit={() => setView('home')} />}
        {view === 'dashboard' && (
          <Dashboard questions={safeQuestions} records={safeRecords} activity={safeActivity} />
        )}
        {view === 'import' && <ImportScreen />}
        {view === 'settings' && <Settings onBack={() => setView('home')} />}

        {/* 縦横切替トグル（スマホ幅のときのみ／上部メニュー跡地）。アイコンで表示。 */}
        {showChrome && !pcWidth && (
          <div className="otoggle" role="group" aria-label="画面の向き">
            <button
              className={!landscape ? 'on' : ''}
              onClick={() => setLandscape(false)}
              aria-label="縦画面"
              aria-pressed={!landscape}
            >
              <Icon name="phone" size={20} />
            </button>
            <button
              className={landscape ? 'on' : ''}
              onClick={() => setLandscape(true)}
              aria-label="横画面"
              aria-pressed={landscape}
            >
              <Icon name="monitor" size={20} />
            </button>
          </div>
        )}

        {/* ナビ：ワイド（PC/横画面）=左サイドバー、縦画面=右下ハンバーガー＋ボトムシート */}
        {showChrome && wide && (
          <nav className="nav">
            <div className="nav-brand" aria-hidden="true">
              <img
                className="nav-brand-logo"
                src={`${import.meta.env.BASE_URL}favicon-48.png`}
                alt=""
                width={30}
                height={30}
              />
              <span>StudyDrill</span>
            </div>
            {NAV_ITEMS.map((it) => (
              <NavBtn
                key={it.view}
                label={it.label}
                icon={it.icon}
                active={view === it.view}
                onClick={() => go(it.view)}
              />
            ))}
          </nav>
        )}

        {showChrome && !wide && (
          <>
            {menuOpen && <div className="nav-scrim" onClick={() => setMenuOpen(false)} />}
            <div className={`nav-sheet${menuOpen ? ' open' : ''}`} role="menu" aria-hidden={!menuOpen}>
              {NAV_ITEMS.map((it) => (
                <button
                  key={it.view}
                  role="menuitem"
                  className={`nav-sheet-item${view === it.view ? ' active' : ''}`}
                  onClick={() => {
                    go(it.view)
                    setMenuOpen(false)
                  }}
                >
                  <span className="ic">
                    <Icon name={it.icon} size={22} strokeWidth={view === it.view ? 2 : 1.8} />
                  </span>
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
            <button
              className={`nav-fab${menuOpen ? ' open' : ''}`}
              aria-label="メニュー"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon name="menu" size={24} strokeWidth={2} />
            </button>
          </>
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
