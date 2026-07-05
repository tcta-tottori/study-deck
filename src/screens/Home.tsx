import { useMemo } from 'react'
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

  // 苦手カテゴリ（回答済で正答率が低い順）上位3
  const weak = [...cats]
    .filter((c) => c.answered > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3)

  return (
    <>
      <header className="appbar">
        <h1>生産管理プランニング3級</h1>
        <span className="spacer" />
        <button className="iconbtn" onClick={() => go('settings')} aria-label="設定">
          ⚙️
        </button>
      </header>

      <div className="screen">
        {/* ゼロ摩擦：最初に大きな開始ボタン */}
        <div className="quickgrid">
          <button className="qbtn primary wide" onClick={() => onStartQuiz({})}>
            <div>
              <div className="big">今すぐ1問</div>
              <div className="sub">続きから・苦手優先で出題</div>
            </div>
            <span style={{ fontSize: 30 }}>⚡</span>
          </button>

          <button className="qbtn" onClick={() => onStartQuiz({ limit: 5 })}>
            <span className="big">5問</span>
            <span className="sub">サッと1分</span>
          </button>
          <button className="qbtn" onClick={() => onStartQuiz({ limit: 10 })}>
            <span className="big">10問</span>
            <span className="sub">しっかり</span>
          </button>
          <button className="qbtn" onClick={() => onStartQuiz({ timeboxSec: 180 })}>
            <span className="big">3分</span>
            <span className="sub">時間で区切る</span>
          </button>
          <button className="qbtn accent" onClick={() => onStartQuiz({ wrongOnly: true })}>
            <span className="big">間違いだけ</span>
            <span className="sub">box1・2を集中</span>
          </button>
          <button className="qbtn wide" onClick={() => go('exam')}>
            <div>
              <div className="big">本番シミュレーション</div>
              <div className="sub">40問・制限時間つき（合格24問）</div>
            </div>
            <span style={{ fontSize: 26 }}>📝</span>
          </button>
        </div>

        {/* 今日の進捗 & ストリーク */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="muted">今日の学習</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {todayCount} <span className="muted" style={{ fontSize: 14 }}>/ {goal} 問</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="muted">連続学習</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                <span className="streak-flame">🔥</span> {streak}日
              </div>
            </div>
          </div>
          <div className="progress" aria-label="今日の目標進捗">
            <span style={{ width: `${goalPct}%` }} />
          </div>
          {goalPct >= 100 && (
            <div className="muted" style={{ marginTop: 8, color: 'var(--correct)' }}>
              🎉 今日の目標を達成しました。
            </div>
          )}
        </div>

        {/* サマリ */}
        <div className="statrow">
          <div className="stat">
            <div className="num">{due}</div>
            <div className="lbl">復習が来ている</div>
          </div>
          <div className="stat">
            <div className="num">{Math.round(acc * 100)}%</div>
            <div className="lbl">全体正答率</div>
          </div>
          <div className="stat">
            <div className="num">{questions?.length ?? '—'}</div>
            <div className="lbl">問題数</div>
          </div>
        </div>

        {/* 苦手カテゴリ */}
        {weak.length > 0 && (
          <div className="card">
            <h2>苦手カテゴリ（タップで集中）</h2>
            {weak.map((c) => (
              <button
                key={c.category}
                className="row"
                style={{ width: '100%', justifyContent: 'space-between', padding: '8px 0' }}
                onClick={() => onStartQuiz({ categories: [c.category], limit: 10 })}
              >
                <span>{categoryLabel(c.category)}</span>
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
        )}
      </div>
    </>
  )
}
