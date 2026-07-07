import { useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { useSettings, useQuestions, useRecordsMap, useActivity } from './hooks/useAppData'
import { updateSettings } from './db/db'
import Home from './screens/Home'
import Quiz, { type QuizConfig } from './screens/Quiz'
import Exam from './screens/Exam'
import Dashboard from './screens/Dashboard'
import ImportScreen from './screens/Import'
import Settings from './screens/Settings'
import ExamHistory from './screens/ExamHistory'
import Toast, { ToastCtx, useToastState } from './components/Toast'
import { scheduleDailyReminder } from './lib/reminder'
import { Icon, type IconName } from './components/Icon'

export type View = 'home' | 'quiz' | 'exam' | 'dashboard' | 'import' | 'settings' | 'exams'

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
  // 起動ローダー（index.html の inline script）が次回起動時に即座に配色を合わせられるよう保存
  try {
    localStorage.setItem('sd-theme', mode)
  } catch {
    /* localStorage 不可環境では無視 */
  }
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
  // ローディングのタイムアウト保険（万一データ取得が詰まっても最終的にアプリを表示）。
  // 通常は「データが揃うまで」ローダーを出し続けるため、保険は長め（15秒）にする。
  // ＝読み込みに2秒以上かかっても、完了までローダーを表示したままにする。
  const [bailout, setBailout] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setBailout(true), 15000)
    return () => clearTimeout(t)
  }, [])
  // 起動ローダー（index.html の #boot）は最低2秒は表示（一瞬で消えるチラつきを防ぐ）
  const [minShown, setMinShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMinShown(true), 2000)
    return () => clearTimeout(t)
  }, [])
  // PWA更新（autoUpdate）で「まもなくリロードされる」間は、ローダーを出したまま覆って
  // 「アプリ→再ローディング」の二重表示（Loadingが2回）に見えないようにする。
  const [swUpdating, setSwUpdating] = useState(
    () => typeof window !== 'undefined' && !!(window as unknown as { __swUpdating?: boolean }).__swUpdating,
  )
  useEffect(() => {
    const h = () => setSwUpdating(true)
    window.addEventListener('sw-updating', h)
    return () => window.removeEventListener('sw-updating', h)
  }, [])

  // テーマ適用（設定 + システム変更を追従）。解決後の明暗をトグルボタン表示に使う。
  const [resolvedDark, setResolvedDark] = useState(false)
  useEffect(() => {
    const mode = settings?.theme ?? 'auto'
    applyTheme(mode)
    setResolvedDark(document.documentElement.getAttribute('data-theme') === 'dark')
    if (mode !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyTheme('auto')
      setResolvedDark(mq.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings?.theme])

  // ライト⇄ダークの手動トグル（現在の解決テーマを反転して設定に保存）
  const toggleTheme = useCallback(() => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setResolvedDark(next === 'dark')
    void updateSettings({ theme: next })
  }, [])

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

  // ページ切替時は必ず先頭を表示（前ページのスクロール位置を持ち越さない）。
  // 縦/PCはウィンドウ、横画面は .app がスクロールコンテナなので両方リセット。
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    const app = document.querySelector('.app') as HTMLElement | null
    if (app) app.scrollTop = 0
  }, [view])

  // 起動ローダー（index.html の #boot）は「初期データが揃い かつ 最低表示時間（2秒）を満たす」
  // まで表示し、その後フェードして隠す。要素は削除せず残す（PWA更新のリロードを覆うため
  // あとで再表示できるようにする）。読み込みが2秒以上かかっても、完了（ready）まで出したまま。
  const ready = questions !== undefined && records !== undefined && activity !== undefined
  useEffect(() => {
    // 更新リロードが近いときは隠さない（リロードをローダーで覆い、Loadingの二重表示を防ぐ）
    if (swUpdating) return
    if (!((ready && minShown) || bailout)) return
    const boot = document.getElementById('boot')
    if (!boot) return
    boot.classList.add('boot-hide')
    const t = setTimeout(() => {
      boot.style.display = 'none'
    }, 420)
    return () => clearTimeout(t)
  }, [ready, minShown, bailout, swUpdating])

  // PWA更新が始まったら、隠していてもローダーを再表示してリロードを覆う。
  // 万一更新が詰まっても永久ローダーにならないよう、保険で最終的に隠す。
  useEffect(() => {
    if (!swUpdating) return
    const boot = document.getElementById('boot')
    if (boot) {
      boot.style.display = ''
      requestAnimationFrame(() => boot.classList.remove('boot-hide'))
    }
    const t = setTimeout(() => {
      const b = document.getElementById('boot')
      if (!b) return
      b.classList.add('boot-hide')
      setTimeout(() => {
        b.style.display = 'none'
      }, 420)
    }, 8000)
    return () => clearTimeout(t)
  }, [swUpdating])

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
        {view === 'exam' && <Exam onExit={() => setView('home')} onReview={startQuiz} />}
        {view === 'dashboard' && (
          <Dashboard
            questions={safeQuestions}
            records={safeRecords}
            activity={safeActivity}
            onHome={() => setView('home')}
            onOpenExams={() => setView('exams')}
          />
        )}
        {view === 'import' && <ImportScreen onHome={() => setView('home')} />}
        {view === 'settings' && <Settings onBack={() => setView('home')} />}
        {view === 'exams' && (
          <ExamHistory onHome={() => setView('home')} onReview={startQuiz} />
        )}
        </div>

        {/* 以下のコントロールは .app（横画面ではスクロールコンテナ）の外に置き、
            スクロールしても回転フレーム基準で固定されるようにする。 */}
        {/* 上部コントロール（スマホ幅のときのみ）：ライト/ダーク切替＋縦横切替を横並びで表示。 */}
        {showChrome && !pcWidth && (
          <div className="top-ctrls">
            <button
              className="tctrl-btn"
              onClick={toggleTheme}
              aria-label={resolvedDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              aria-pressed={resolvedDark}
            >
              <Icon name={resolvedDark ? 'sun' : 'moon'} size={20} />
            </button>
            <button
              className="tctrl-btn"
              onClick={() => setLandscape(!landscape)}
              aria-label={landscape ? '縦画面に切り替え' : '横画面に切り替え'}
              aria-pressed={landscape}
            >
              <Icon name="swap" size={22} />
            </button>
          </div>
        )}

        {/* ナビ：縦画面/横画面/PC いずれも右下ハンバーガー＋下から立ち上がるボトムシート */}
        {showChrome && (
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
    </ToastCtx.Provider>
  )
}

