import { useMemo, useRef, useState } from 'react'
import type { View } from '../App'
import type { QuizConfig } from './Quiz'
import { computeStreak, dayKey, daysUntil, formatJpDate } from '../lib/dateutil'
import { categoryStats, dueCount, overallAccuracy } from '../lib/stats'
import { categoryLabel, type AppSettings, type Question, type StudyRecord } from '../types'
import { updateSettings, type DayActivity } from '../db/db'
import { categoryColor } from '../lib/categoryMap'
import { SUBJECTS, getSubject } from '../lib/subjects'
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

  // 学習中の科目（試験）。ヘッダー名タップ or 設定から変更可能。
  const subject = getSubject(settings.subjectId)
  const [pickerOpen, setPickerOpen] = useState(false)
  function chooseSubject(id: string) {
    setPickerOpen(false)
    if (id !== settings.subjectId) void updateSettings({ subjectId: id })
  }

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
          width={34}
          height={34}
        />
        <button
          className="subject-pick"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-label="科目を変更"
        >
          <span className="subject-name">{subject.name}</span>
          <span className="subject-caret">
            <Icon name="chevron" size={16} strokeWidth={2.2} />
          </span>
        </button>
      </header>

      {pickerOpen && (
        <div className="subject-backdrop" onClick={() => setPickerOpen(false)}>
          <div
            className="subject-sheet"
            role="dialog"
            aria-label="科目を選択"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="subject-sheet-title">科目を選択</div>
            {SUBJECTS.map((sub) => {
              const active = sub.id === subject.id
              return (
                <button
                  key={sub.id}
                  className={`subject-opt${active ? ' active' : ''}`}
                  onClick={() => chooseSubject(sub.id)}
                >
                  <span className="subject-opt-name">{sub.name}</span>
                  {active && <Icon name="check" size={18} strokeWidth={2.4} />}
                </button>
              )
            })}
            <p className="muted subject-note">他の科目は今後追加予定です。</p>
          </div>
        </div>
      )}

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
            <span className="hero-title">
              <span className="hero-ic">
                <Icon name="book" size={20} />
              </span>
              今日の学習
            </span>
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
          </div>
          <div className="hero-sub">
            <button className="hero-review" onClick={() => onStartQuiz({ wrongOnly: true })}>
              <Icon name="refresh" size={18} />
              間違い復習
            </button>
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

        {/* 試験形式（今日の学習と同様、要素を1枠にまとめた赤いカード） */}
        <Reveal>
        <section className="examcard">
          <div className="ec-title">
            <span className="ec-ic">
              <Icon name="clipboard" size={20} />
            </span>
            試験形式
          </div>
          <div className="ec-desc">公式問題を優先して40問・制限時間つき。本番と同じ形式で実力チェック。</div>
          <div className="ec-figure">
            <span className="big">24</span>
            <span className="unit">問正解で合格（60点）</span>
          </div>
          <button className="ec-action" onClick={() => go('exam')}>
            開始する
          </button>
          <button className="pc-sublink" onClick={() => go('exams')}>
            <Icon name="chart" size={16} />
            受験履歴・復習を見る
            <Icon name="arrow" size={15} />
          </button>
        </section>
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
