import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuizConfig } from './Quiz'
import type { AppSettings, Question, StudyRecord, WrongLog } from '../types'
import { getWrongLogsByDay, getRecentWrongLogs, updateSettings, type DayActivity } from '../db/db'
import { dayKey } from '../lib/dateutil'
import {
  buildTodayScript,
  buildWeakScript,
  estimateSeconds,
  sectionStarts,
  type VoiceMode,
  type VoiceScript,
} from '../lib/voiceScript'
import { TtsPlayer, ttsSupported, loadVoices, japaneseVoices, pickVoice, type TtsState } from '../lib/tts'
import { BackHome } from '../components/BackHome'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'

const RATES = [0.8, 1.0, 1.2, 1.5]

export default function VoiceReview({
  settings,
  questions,
  records,
  activity,
  onHome,
  onStartQuiz,
}: {
  settings: AppSettings
  questions: Question[]
  records: Map<string, StudyRecord>
  activity: DayActivity[]
  onHome: () => void
  onStartQuiz: (cfg: QuizConfig) => void
}) {
  const toast = useToast()
  const supported = ttsSupported()

  const [mode, setMode] = useState<VoiceMode>('today')
  const [todayLogs, setTodayLogs] = useState<WrongLog[] | null>(null)
  const [recentLogs, setRecentLogs] = useState<WrongLog[] | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [state, setState] = useState<TtsState>('idle')
  const [index, setIndex] = useState(0)
  const [rate, setRate] = useState(settings.voiceRate ?? 1)
  const [voiceName, setVoiceName] = useState(settings.voiceName)

  const playerRef = useRef<TtsPlayer | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  // 誤答ログの読み込み（当日ぶんと直近30日ぶん）
  useEffect(() => {
    let alive = true
    void (async () => {
      const [today, recent] = await Promise.all([
        getWrongLogsByDay(dayKey(Date.now())),
        getRecentWrongLogs(30),
      ])
      if (!alive) return
      setTodayLogs(today)
      setRecentLogs(recent)
    })()
    return () => {
      alive = false
    }
  }, [])

  // 端末の音声一覧（日本語の声を優先表示）
  useEffect(() => {
    let alive = true
    void loadVoices().then((vs) => {
      if (!alive) return
      setVoices(vs)
      setVoicesLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const script: VoiceScript | null = useMemo(() => {
    if (todayLogs === null || recentLogs === null) return null
    const opts = {
      includeStem: settings.voiceIncludeStem !== false,
      weakLimit: settings.voiceWeakCount ?? 5,
    }
    if (mode === 'today') {
      const today = activity.find((a) => a.day === dayKey(Date.now()))
      return buildTodayScript(questions, todayLogs, today, opts)
    }
    return buildWeakScript(questions, records, recentLogs, opts)
  }, [mode, todayLogs, recentLogs, questions, records, activity, settings.voiceIncludeStem, settings.voiceWeakCount])

  // 画面がスリープしないように（対応端末のみ・失敗しても読み上げは続く）
  const requestWakeLock = useCallback(async () => {
    type WakeLockNavigator = Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> }
    }
    const nav = navigator as WakeLockNavigator
    if (!nav.wakeLock || wakeLockRef.current) return
    try {
      wakeLockRef.current = await nav.wakeLock.request('screen')
    } catch {
      /* 非対応・拒否時は何もしない */
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current
    wakeLockRef.current = null
    if (lock) void lock.release().catch(() => undefined)
  }, [])

  // プレイヤーは画面の生存中1つだけ持つ
  useEffect(() => {
    const p = new TtsPlayer({
      onIndex: setIndex,
      onState: (s) => {
        setState(s)
        if (s === 'playing') void requestWakeLock()
        else releaseWakeLock()
      },
      onError: (m) => toast(m),
    })
    playerRef.current = p
    return () => {
      p.dispose()
      playerRef.current = null
      releaseWakeLock()
    }
  }, [toast, requestWakeLock, releaseWakeLock])

  // 原稿が変わったら読み上げキューを差し替える
  useEffect(() => {
    if (!script || !playerRef.current) return
    playerRef.current.setQueue(script.segments)
    setIndex(0)
    setState('idle')
  }, [script])

  // 声・速度の反映（設定にも保存）
  useEffect(() => {
    if (!playerRef.current) return
    playerRef.current.setVoice(pickVoice(voices, voiceName))
  }, [voices, voiceName])

  useEffect(() => {
    playerRef.current?.setRate(rate)
  }, [rate])

  // 自動再生（設定ON時のみ。iOS等では操作なしの再生がブロックされることがある）
  const autoPlayedRef = useRef(false)
  useEffect(() => {
    if (!settings.voiceAutoPlay || autoPlayedRef.current) return
    if (!script || script.segments.length === 0 || script.emptyMessage) return
    autoPlayedRef.current = true
    playerRef.current?.play(0)
  }, [script, settings.voiceAutoPlay])

  // 読み上げ位置を画面内に保つ
  const current = script?.map[index]
  useEffect(() => {
    if (!current) return
    const el = listRef.current?.querySelector(`[data-block="${current.section}-${current.block}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current?.section, current?.block]) // eslint-disable-line react-hooks/exhaustive-deps

  const starts = useMemo(() => (script ? sectionStarts(script) : []), [script])

  function jumpSection(delta: number) {
    if (!script || starts.length === 0) return
    const curSection = script.map[index]?.section ?? 0
    const target = Math.max(0, Math.min(curSection + delta, starts.length - 1))
    playerRef.current?.seek(starts[target], state === 'playing')
  }

  function changeRate(r: number) {
    setRate(r)
    void updateSettings({ voiceRate: r })
  }

  function changeVoice(name: string) {
    setVoiceName(name || undefined)
    void updateSettings({ voiceName: name || undefined })
  }

  const jaVoices = japaneseVoices(voices)
  const otherVoices = voices.filter((v) => !v.lang?.toLowerCase().startsWith('ja'))
  const activeSection = current?.section ?? 0
  const currentText = script?.sections[activeSection]?.blocks[current?.block ?? 0]?.text ?? ''
  const totalSec = script ? estimateSeconds(script, rate) : 0
  const progress = script && script.segments.length > 0 ? ((index + 1) / script.segments.length) * 100 : 0
  const empty = !!script?.emptyMessage

  return (
    <>
      <header className="appbar">
        <BackHome onClick={onHome} />
        <h1>音声で復習</h1>
      </header>

      <div className="screen">
        <div className="seg vr-modes">
          <button className={mode === 'today' ? 'on' : ''} onClick={() => setMode('today')}>
            今日の間違い
          </button>
          <button className={mode === 'weak' ? 'on' : ''} onClick={() => setMode('weak')}>
            苦手・頻出
          </button>
        </div>

        {!supported && (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              この端末（ブラウザ）は音声読み上げに対応していません。Safari・Chrome の最新版でお試しください。
              原稿は下に表示されるので、読み上げなしでも復習できます。
            </p>
          </div>
        )}

        {script === null ? (
          <div className="empty">読み込み中…</div>
        ) : (
          <>
            {/* プレイヤー */}
            <section className="vr-player">
              <div className="vr-head">
                <span className="vr-title">
                  <span className="vr-ic">
                    <Icon name="speaker" size={20} />
                  </span>
                  {script.title}
                </span>
                <span className="vr-sum">{script.summary}</span>
              </div>

              <div className="vr-now">{empty ? script.emptyMessage : currentText || '再生ボタンで始めます'}</div>

              {empty && mode === 'today' && (
                <button className="vr-switch" onClick={() => setMode('weak')}>
                  代わりに「苦手・頻出」を聞く
                </button>
              )}

              <div className="vr-bar">
                <span style={{ width: `${empty ? 0 : progress}%` }} />
              </div>
              <div className="vr-meta">
                {empty ? (
                  <span>読み上げる内容がありません</span>
                ) : (
                  <>
                    <span>
                      {Math.min(index + 1, script.segments.length)} / {script.segments.length}
                    </span>
                    <span>
                      全体 約{Math.floor(totalSec / 60)}分{String(totalSec % 60).padStart(2, '0')}秒
                    </span>
                  </>
                )}
              </div>

              <div className="vr-ctrls">
                <button
                  className="vr-btn"
                  aria-label="前の項目"
                  disabled={!supported || empty}
                  onClick={() => jumpSection(-1)}
                >
                  <Icon name="prev" size={22} />
                </button>
                <button
                  className="vr-play"
                  aria-label={state === 'playing' ? '一時停止' : '再生'}
                  disabled={!supported || empty}
                  onClick={() => {
                    const p = playerRef.current
                    if (!p) return
                    if (state === 'playing') p.pause()
                    else if (state === 'paused') p.resume()
                    else p.play()
                  }}
                >
                  <Icon name={state === 'playing' ? 'pause' : 'play'} size={30} />
                </button>
                <button
                  className="vr-btn"
                  aria-label="次の項目"
                  disabled={!supported || empty}
                  onClick={() => jumpSection(1)}
                >
                  <Icon name="next" size={22} />
                </button>
                <button
                  className="vr-btn"
                  aria-label="最初から"
                  disabled={!supported || empty}
                  onClick={() => playerRef.current?.seek(0, true)}
                >
                  <Icon name="refresh" size={20} />
                </button>
              </div>

              <div className="vr-rate">
                <span className="vr-rate-lbl">速さ</span>
                <div className="seg sm">
                  {RATES.map((r) => (
                    <button key={r} className={rate === r ? 'on' : ''} onClick={() => changeRate(r)}>
                      {r.toFixed(1)}×
                    </button>
                  ))}
                </div>
              </div>

              {supported && (jaVoices.length > 0 || otherVoices.length > 0) && (
                <label className="vr-voice">
                  <span className="vr-rate-lbl">声</span>
                  <select value={voiceName ?? ''} onChange={(e) => changeVoice(e.target.value)}>
                    <option value="">自動（日本語）</option>
                    {jaVoices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name}
                        {v.localService ? '（オフライン）' : ''}
                      </option>
                    ))}
                    {otherVoices.length > 0 && (
                      <optgroup label="その他の言語">
                        {otherVoices.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name}（{v.lang}）
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
              )}

              {supported && voicesLoaded && voices.length === 0 && (
                <p className="muted vr-note">
                  この端末には読み上げ音声がインストールされていないようです。端末の設定（iPhone:
                  アクセシビリティ＞読み上げコンテンツ、Android: ユーザー補助＞テキスト読み上げ）から
                  日本語の音声を追加すると再生できます。原稿は下に表示されています。
                </p>
              )}
              {supported && jaVoices.length === 0 && voices.length > 0 && (
                <p className="muted vr-note">
                  日本語の音声が見つかりませんでした。端末の設定で日本語の読み上げ音声を追加すると自然に聞こえます。
                </p>
              )}
            </section>

            {/* 原稿（読み上げ中の行をハイライト。タップでその位置から再生） */}
            <div className="vr-script" ref={listRef}>
              {script.sections.map((sec, si) => (
                <section key={sec.key} className={`vr-sec${si === activeSection ? ' active' : ''}`}>
                  <div className="vr-sec-head">
                    <span className="vr-sec-title">{sec.heading}</span>
                    {sec.sub && <span className="vr-sec-sub">{sec.sub}</span>}
                  </div>
                  {sec.blocks.map((b, bi) => {
                    const isCur = si === activeSection && bi === (current?.block ?? -1)
                    const segIndex = script.map.findIndex((m) => m.section === si && m.block === bi)
                    return (
                      <button
                        key={bi}
                        data-block={`${si}-${bi}`}
                        className={`vr-line vr-${b.kind}${isCur ? ' cur' : ''}`}
                        disabled={!supported || segIndex < 0}
                        onClick={() => segIndex >= 0 && playerRef.current?.seek(segIndex, true)}
                      >
                        {b.label && <span className="vr-line-lbl">{b.label}</span>}
                        <span className="vr-line-text">{b.text}</span>
                      </button>
                    )
                  })}
                </section>
              ))}
            </div>

            {!empty && (
              <div className="review-actions vr-actions">
                <button
                  className="btn primary sm"
                  onClick={() => {
                    playerRef.current?.stop()
                    const ids = script.sections.map((s) => s.questionId).filter((x): x is string => !!x)
                    if (ids.length === 0) return
                    onStartQuiz({ questionIds: ids, title: '音声で聞いた問題の解き直し' })
                  }}
                >
                  聞いた問題を解き直す
                </button>
                <button
                  className="btn sm"
                  onClick={() => {
                    playerRef.current?.stop()
                    onStartQuiz({ wrongOnly: true })
                  }}
                >
                  間違い復習へ
                </button>
              </div>
            )}

            <p className="muted vr-foot">
              読み上げは端末内蔵の音声合成を使っています。通信もAPIキーも不要で、機内モードでも動作します
              （端末にダウンロード済みの音声を使う場合）。
            </p>
          </>
        )}
      </div>
    </>
  )
}
