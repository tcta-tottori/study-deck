import { useMemo, useRef } from 'react'
import type { View } from '../App'
import type { QuizConfig } from './Quiz'
import { computeStreak, dayKey, daysUntil, formatJpDate } from '../lib/dateutil'
import { categoryStats, dueCount, overallAccuracy } from '../lib/stats'
import { categoryLabel, type AppSettings, type Question, type StudyRecord } from '../types'
import type { DayActivity } from '../db/db'
import { categoryColor } from '../lib/categoryMap'
import { Icon } from '../components/Icon'
import Reveal from '../components/Reveal'

export default function Home({
  onStartQuiz,
  go,
  settings,
  questions,
  records,
  activity,
}: {
  onStartQuiz: (cfg: QuizConfig) => void
  go: (v: View) => void
  settings: AppSettings
  questions: Question[]
  records: Map<string, StudyRecord>
  activity: DayActivity[]
}) {
  // now は初回マウント時に1回だけ確定（毎レンダーでの再計算/ちらつきを防ぐ）
  const nowRef = useRef(Date.now())
  const now = nowRef.current
  const todayKey = dayKey(now)

  const { streak, todayCount, due, acc, cats } = useMemo(() => {
    const days = new Set(activity.map((a) => a.day))
    const today = activity.find((a) => a.day === todayKey)
    return {
      streak: computeStreak(days, todayKey),
      todayCount: today?.count ?? 0,
      due: dueCount(records, now),
      acc: overallAccuracy(records),
      cats: categoryStats(questions, records),
    }
  }, [activity, records, questions, todayKey, now])

  const goal = settings.dailyGoal
  const goalPct = Math.min(100, Math.round((todayCount / goal) * 100))

  const examDate = settings.examDate
  const daysLeft = daysUntil(examDate, now)

  // 学習済みを正答率の低い順（＝苦手優先）に、未学習は末尾へ
  const catSorted = [...cats].sort((a, b) => {
    const aUn = a.answered === 0
    const bUn = b.answered === 0
    if (aUn !== bUn) return aUn ? 1 : -1
    return a.accuracy - b.accuracy
  })

  return (
    <>
      <header className="appbar">
        <img
          className="app-logo"
          src={`${import.meta.env.BASE_URL}favicon-48.png`}
          alt=""
          width={28}
          height={28}
        />
        <h1>StudyDrill</h1>
      </header>

      <div className="screen">
        <div className="home-grid">
        <div className="home-main">
        {/* 試験までのカウントダウン（タップで設定へ） */}
        <button className="countdown" onClick={() => go('settings')}>
          <span className="cd-ic">
            <Icon name="calendar" size={20} />
          </span>
          <span className="cd-body">
            <span className="cd-label">試験まで</span>
            <span className="cd-main">
              {Number.isNaN(daysLeft) ? (
                '試験日を設定'
              ) : daysLeft > 0 ? (
                <>
                  あと<strong>{daysLeft}</strong>日
                </>
              ) : daysLeft === 0 ? (
                <strong>本番当日！</strong>
              ) : (
                '試験日を過ぎています'
              )}
            </span>
          </span>
          <span className="cd-date">{formatJpDate(examDate)}</span>
        </button>

        {/* ヒーローカード（今日の学習 + ワンタップ開始） */}
        <Reveal>
        <section className="hero">
          <div className="hero-top">
            <span>今日の学習</span>
            <span className="hero-streak">
              <Icon name="flame" size={15} /> {streak}日連続
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
              <Icon name="bolt" size={19} /> 今すぐ1問
            </button>
            <button className="mini" onClick={() => onStartQuiz({ wrongOnly: true })}>
              <Icon name="refresh" size={19} />
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
        </Reveal>

        {/* 本番シミュレーション（商品カード風） */}
        <div className="sec-head">
          <h2>試験対策</h2>
        </div>
        <Reveal>
        <div className="prodcard">
          <div className="pc-title">
            <span className="pc-ic">
              <Icon name="clipboard" size={20} />
            </span>
            本番シミュレーション
          </div>
          <div className="pc-desc">公式問題を優先して40問・制限時間つき。本番と同じ形式で実力チェック。</div>
          <div className="pc-figure">
            <span className="big">24</span>
            <span className="unit">問正解で合格（60点）</span>
          </div>
          <button className="pc-action filled" onClick={() => go('exam')}>
            開始する
          </button>
        </div>
        </Reveal>
        </div>

        <div className="home-side">
        {/* カテゴリ別（正答率つき・タップでそのカテゴリを出題） */}
        <div className="sec-head">
          <h2>カテゴリ別に学習</h2>
          <span className="muted">タップで出題</span>
        </div>
        <Reveal>
        <div className="catlist">
          {catSorted.map((c) => {
            const pct = Math.round(c.accuracy * 100)
            const answered = c.answered > 0
            const col = categoryColor(c.category) // カテゴリ識別カラー
            return (
              <button
                key={c.category}
                className="cat-row"
                style={{ borderLeft: `5px solid ${col}` }}
                onClick={() => onStartQuiz({ categories: [c.category], limit: 10 })}
              >
                <div className="cat-top">
                  <span className="cat-name">
                    <span className="cat-dot" style={{ background: col }} />
                    {categoryLabel(c.category)}
                  </span>
                  <span className="cat-acc" style={{ color: answered ? col : 'var(--text-dim)' }}>
                    {answered ? `${pct}%` : '未学習'}
                  </span>
                </div>
                <div className="cat-bar">
                  <span style={{ width: `${answered ? pct : 0}%`, background: col }} />
                </div>
                <div className="cat-sub">
                  学習 {c.answered}/{c.total}問{answered ? ` ・ 正解${c.correct}・誤答${c.wrong}` : ''}
                </div>
              </button>
            )
          })}
        </div>
        </Reveal>
        </div>
        </div>
      </div>
    </>
  )
}
