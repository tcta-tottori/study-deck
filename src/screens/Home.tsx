import { useMemo, useState } from 'react'
import type { View } from '../App'
import type { QuizConfig } from './Quiz'
import { useActivity, useQuestions, useRecordsMap, useSettings } from '../hooks/useAppData'
import { computeStreak, dayKey } from '../lib/dateutil'
import { categoryStats, dueCount, overallAccuracy } from '../lib/stats'
import { categoryLabel } from '../types'

export default function Home({
  onStartQuiz,
  go,
}: {
  onStartQuiz: (cfg: QuizConfig) => void
  go: (v: View) => void
}) {
  const settings = useSettings()
  const questions = useQuestions()
  const records = useRecordsMap()
  const activity = useActivity()
  const [simple, setSimple] = useState(false)

  const now = Date.now()
  const todayKey = dayKey(now)

  const { streak, todayCount, due, acc, cats } = useMemo(() => {
    const days = new Set((activity ?? []).map((a) => a.day))
    const today = (activity ?? []).find((a) => a.day === todayKey)
    return {
      streak: computeStreak(days, todayKey),
      todayCount: today?.count ?? 0,
      due: records ? dueCount(records, now) : 0,
      acc: records ? overallAccuracy(records) : 0,
      cats: questions && records ? categoryStats(questions, records) : [],
    }
  }, [activity, records, questions, todayKey, now])

  const goal = settings?.dailyGoal ?? 20
  const goalPct = Math.min(100, Math.round((todayCount / goal) * 100))

  const weak = [...cats]
    .filter((c) => c.answered > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4)

  return (
    <>
      <header className="appbar">
        <h1>生産管理プランニング3級</h1>
        <span className="spacer" />
        <button className="iconbtn" onClick={() => go('dashboard')} aria-label="成績">
          📊
        </button>
        <button className="iconbtn" onClick={() => go('settings')} aria-label="設定">
          ⚙️
        </button>
      </header>

      <div className="screen">
        <div className="seg" role="tablist">
          <button className={!simple ? 'on' : ''} onClick={() => setSimple(false)}>
            通常
          </button>
          <button className={simple ? 'on' : ''} onClick={() => setSimple(true)}>
            シンプル
          </button>
        </div>

        {/* ヒーローカード（今日の学習 + ワンタップ開始） */}
        <section className="hero">
          <div className="hero-top">
            <span>今日の学習</span>
            <span className="hero-streak">
              <span className="streak-flame">🔥</span> {streak}日連続
            </span>
          </div>
          <div className="hero-num">
            {todayCount}
            <small>/ {goal} 問</small>
          </div>
          <div className="hero-progress">
            <span style={{ width: `${goalPct}%` }} />
          </div>
          <div className="hero-cta">
            <button className="go" onClick={() => onStartQuiz({})}>
              ⚡ 今すぐ1問
            </button>
            <button className="mini" onClick={() => onStartQuiz({ wrongOnly: true })}>
              <span style={{ fontSize: 18 }}>🩹</span>
              間違い
              <br />
              だけ
            </button>
          </div>
          <div className="hero-sub">
            <div>
              <div className="v">{due}</div>
              <div className="k">復習が来ている</div>
            </div>
            <div>
              <div className="v">{Math.round(acc * 100)}%</div>
              <div className="k">全体正答率</div>
            </div>
            <div>
              <div className="v">{questions?.length ?? '—'}</div>
              <div className="k">問題数</div>
            </div>
          </div>
        </section>

        {/* マイクロセッション・タイル */}
        <div className="sec-head">
          <h2>クイックスタート</h2>
          <button onClick={() => onStartQuiz({})}>すべて出題 ›</button>
        </div>
        <div className="tiles">
          <button className="tile" onClick={() => onStartQuiz({ limit: 5 })}>
            <span className="tile-ic" style={{ background: 'var(--tile-blue)' }}>
              ⚡
            </span>
            <span className="lbl">5問</span>
            <span className="sub">1分</span>
          </button>
          <button className="tile" onClick={() => onStartQuiz({ limit: 10 })}>
            <span className="tile-ic" style={{ background: 'var(--tile-green)' }}>
              📗
            </span>
            <span className="lbl">10問</span>
            <span className="sub">しっかり</span>
          </button>
          <button className="tile" onClick={() => onStartQuiz({ timeboxSec: 180 })}>
            <span className="tile-ic" style={{ background: 'var(--tile-gold)' }}>
              ⏱️
            </span>
            <span className="lbl">3分</span>
            <span className="sub">時間で</span>
          </button>
          <button className="tile" onClick={() => onStartQuiz({ wrongOnly: true })}>
            <span className="tile-ic" style={{ background: 'var(--tile-purple)' }}>
              🩹
            </span>
            <span className="lbl">復習</span>
            <span className="sub">苦手</span>
          </button>
        </div>

        {/* 本番シミュレーション（商品カード風） */}
        <div className="sec-head">
          <h2>試験対策</h2>
        </div>
        <div className="prodcard">
          <div className="pc-title">📝 本番シミュレーション</div>
          <div className="pc-desc">公式問題を優先して40問・制限時間つき。本番と同じ形式で実力チェック。</div>
          <div className="pc-figure">
            <span className="big">24</span>
            <span className="unit">問正解で合格（60点）</span>
          </div>
          <button className="pc-action filled" onClick={() => go('exam')}>
            開始する
          </button>
        </div>

        {/* 苦手カテゴリ（通常表示のみ） */}
        {!simple && weak.length > 0 && (
          <>
            <div className="sec-head">
              <h2>苦手カテゴリ</h2>
              <span className="muted">タップで集中</span>
            </div>
            <div className="card">
              {weak.map((c) => (
                <button
                  key={c.category}
                  className="row"
                  style={{ width: '100%', justifyContent: 'space-between', padding: '9px 0' }}
                  onClick={() => onStartQuiz({ categories: [c.category], limit: 10 })}
                >
                  <span style={{ fontWeight: 600 }}>{categoryLabel(c.category)}</span>
                  <span
                    className="chip"
                    style={{
                      background: c.accuracy < 0.5 ? 'var(--wrong-bg)' : 'var(--surface-2)',
                      color: c.accuracy < 0.5 ? 'var(--wrong)' : 'var(--text-dim)',
                    }}
                  >
                    {Math.round(c.accuracy * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
