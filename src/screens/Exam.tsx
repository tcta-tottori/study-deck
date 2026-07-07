import { useEffect, useMemo, useRef, useState } from 'react'
import { db, getSettings } from '../db/db'
import { recordAnswer } from '../lib/study'
import { categoryLabel, type ExamResult, type Question } from '../types'
import { formatClock, formatDuration } from '../lib/dateutil'
import { Icon } from '../components/Icon'
import { listSessions, questionsForSession, pickBalanced, type ExamSession } from '../lib/exam'

const LETTERS = ['ア', 'イ', 'ウ', 'エ']
const EXAM_N = 40
const PASS_RATIO = 0.6 // 6割で合格

type StartMode = { mode: 'random' } | { mode: 'session'; key: string }

type Phase = 'intro' | 'running' | 'result'

export default function Exam({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [cur, setCur] = useState(0)
  const [durationSec, setDurationSec] = useState(110 * 60)
  const [remaining, setRemaining] = useState(110 * 60)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const available = allQuestions.length
  const startedAt = useRef(0)
  const submittedRef = useRef(false)

  useEffect(() => {
    getSettings().then((s) => {
      setDurationSec(s.examDurationSec)
      setRemaining(s.examDurationSec)
    })
    db.questions.toArray().then((all) => {
      setAllQuestions(all)
      setSessions(listSessions(all))
    })
  }, [])

  function start(opts: StartMode) {
    const picked =
      opts.mode === 'session'
        ? questionsForSession(allQuestions, opts.key)
        : pickBalanced(allQuestions, EXAM_N)
    if (picked.length === 0) return
    setQuestions(picked)
    setAnswers(new Array(picked.length).fill(-1))
    setCur(0)
    setRemaining(durationSec)
    startedAt.current = Date.now()
    submittedRef.current = false
    setPhase('running')
  }

  // カウントダウン（0で自動提出）
  useEffect(() => {
    if (phase !== 'running') return
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t)
          void submit()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function pick(choice: number) {
    setAnswers((a) => {
      const next = a.slice()
      next[cur] = choice
      return next
    })
  }

  async function submit() {
    if (submittedRef.current) return
    submittedRef.current = true
    const durationSecTaken = Math.min(
      durationSec,
      Math.round((Date.now() - startedAt.current) / 1000),
    )

    let correct = 0
    const byCategory: Record<string, { correct: number; total: number }> = {}
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const a = answers[i]
      const isCorrect = a === q.answerIndex
      if (isCorrect) correct++
      const cat = q.category
      byCategory[cat] = byCategory[cat] ?? { correct: 0, total: 0 }
      byCategory[cat].total++
      if (isCorrect) byCategory[cat].correct++
      // 回答済のみSRSへ反映（誤答はbox1へ→見直し対象）
      if (a >= 0) await recordAnswer(q, a)
    }

    const total = questions.length
    const score = Math.round((correct / total) * 100 * 10) / 10
    const res: ExamResult = {
      takenAt: Date.now(),
      total,
      correct,
      score,
      passed: correct / total >= PASS_RATIO,
      durationSec: durationSecTaken,
      byCategory,
      questionIds: questions.map((q) => q.id),
      answers: answers.slice(),
    }
    const id = await db.examResults.add(res)
    setResult({ ...res, id })
    setPhase('result')
  }

  if (phase === 'intro') {
    const mins = Math.round(durationSec / 60)
    const randomN = Math.min(EXAM_N, available)
    return (
      <div className="quiz">
        <div className="quiz-top">
          <div className="quiz-meta">
            <button className="btn ghost sm" onClick={onExit}>
              × 戻る
            </button>
            <span>本番シミュレーション</span>
            <span />
          </div>
        </div>
        <div className="exam-intro">
          <div className="card">
            <h2>本番形式（4択・6割で合格）</h2>
            <p className="muted" style={{ margin: 0 }}>
              制限時間 {mins}分／試験中は正誤非表示（提出後に採点）。総取込 {available}問。
            </p>
          </div>

          <div className="sec-head">
            <h2>ランダム出題</h2>
          </div>
          <button
            className="exam-card"
            disabled={available === 0}
            onClick={() => start({ mode: 'random' })}
          >
            <span className="exam-card-main">
              <span className="exam-card-title">全分野バランス {randomN}問</span>
              <span className="exam-card-sub">7分野の出題比率を調整してランダム出題</span>
            </span>
            <Icon name="arrow" size={18} />
          </button>

          <div className="sec-head">
            <h2>過去問（年度・回別）</h2>
          </div>
          {sessions.length === 0 ? (
            <p className="muted exam-empty">
              公式の過去問が未取込です。「取込」タブから公式問題（ID: OFF-R06E / R06L …）を追加すると、
              年度・前期／後期ごとにその回を丸ごと受験できます。
            </p>
          ) : (
            <div className="exam-sessions">
              {sessions.map((s) => (
                <button
                  key={s.key}
                  className="exam-card"
                  onClick={() => start({ mode: 'session', key: s.key })}
                >
                  <span className="exam-card-main">
                    <span className="exam-card-title">{s.label}</span>
                    <span className="exam-card-sub">{s.count}問</span>
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'running') {
    const q = questions[cur]
    const danger = remaining <= 60
    return (
      <div className="quiz">
        <div className="quiz-top">
          <div className="quiz-meta">
            <span>
              {cur + 1} / {questions.length}
            </span>
            <span className={`exam-timer ${danger ? 'danger' : ''}`}>{formatClock(remaining)}</span>
            <button className="btn ghost sm" onClick={() => void submit()}>
              提出
            </button>
          </div>
          <div className="stem">{q.stem}</div>
        </div>
        <div className="quiz-spacer" />
        <div className="choices">
          {q.choices.map((c, i) => (
            <button
              key={i}
              className={`choice ${answers[cur] === i ? 'correct' : ''}`}
              onClick={() => pick(i)}
            >
              <span className="mark">{LETTERS[i]}</span>
              <span>{c}</span>
            </button>
          ))}
        </div>
        <div className="nextbar">
          <button className="btn" disabled={cur === 0} onClick={() => setCur((c) => c - 1)}>
            ← 前
          </button>
          {cur < questions.length - 1 ? (
            <button className="btn primary" onClick={() => setCur((c) => c + 1)}>
              次 →
            </button>
          ) : (
            <button className="btn primary" onClick={() => void submit()}>
              提出する
            </button>
          )}
        </div>
        <div className="pager">
          {questions.map((_, i) => (
            <button
              key={i}
              className={`${answers[i] >= 0 ? 'answered' : ''} ${i === cur ? 'current' : ''}`}
              onClick={() => setCur(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // result
  return (
    <ExamResultView
      result={result!}
      questions={questions}
      answers={answers}
      onExit={onExit}
      onRetry={() => setPhase('intro')}
    />
  )
}

function ExamResultView({
  result,
  questions,
  answers,
  onExit,
  onRetry,
}: {
  result: ExamResult
  questions: Question[]
  answers: number[]
  onExit: () => void
  onRetry: () => void
}) {
  const [reviewOnly, setReviewOnly] = useState(true)
  const wrongIdx = useMemo(
    () => questions.map((q, i) => (answers[i] !== q.answerIndex ? i : -1)).filter((i) => i >= 0),
    [questions, answers],
  )
  const listIdx = reviewOnly ? wrongIdx : questions.map((_, i) => i)

  return (
    <div className="screen" style={{ paddingTop: 16 }}>
      <div className="card result-hero">
        <div className="muted">得点</div>
        <div className="score">{result.score}</div>
        <div className="muted">{result.correct} / {result.total} 問正解</div>
        <div>
          <span className={`badge ${result.passed ? 'pass' : 'fail'}`}>
            {result.passed ? '合格' : '不合格'}
          </span>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          所要時間 {formatDuration(result.durationSec)}
        </div>
      </div>

      <div className="card">
        <h2>カテゴリ別内訳</h2>
        {Object.entries(result.byCategory)
          .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
          .map(([cat, v]) => {
            const pct = Math.round((v.correct / v.total) * 100)
            return (
              <div className="bar-item" key={cat}>
                <div className="bar-head">
                  <span>{categoryLabel(cat as Question['category'])}</span>
                  <span className="muted">
                    {v.correct}/{v.total}
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 60 ? 'var(--correct)' : 'var(--wrong)',
                    }}
                  />
                </div>
              </div>
            )
          })}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', margin: '4px 4px 12px' }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>見直し</h2>
        <button className="chip" onClick={() => setReviewOnly((v) => !v)}>
          {reviewOnly ? `誤答のみ (${wrongIdx.length})` : '全問'}
        </button>
      </div>

      {listIdx.length === 0 && <div className="empty">全問正解！素晴らしい。</div>}

      {listIdx.map((i) => {
        const q = questions[i]
        const mine = answers[i]
        const ok = mine === q.answerIndex
        return (
          <div className="card" key={q.id}>
            <div className="muted" style={{ marginBottom: 6 }}>
              第{i + 1}問・{categoryLabel(q.category)}
            </div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{q.stem}</div>
            {q.choices.map((c, ci) => {
              let cls = 'choice'
              if (ci === q.answerIndex) cls += ' correct'
              else if (ci === mine) cls += ' wrong'
              else cls += ' dimmed'
              return (
                <div key={ci} className={cls} style={{ marginBottom: 8, minHeight: 0, padding: 12 }}>
                  <span className="mark">{LETTERS[ci]}</span>
                  <span>{c}</span>
                </div>
              )
            })}
            {!ok && mine < 0 && <p className="muted">（未回答）</p>}
            {q.explanation && <p style={{ fontSize: 14 }}>{q.explanation}</p>}
          </div>
        )
      })}

      <div className="nextbar" style={{ marginTop: 8 }}>
        <button className="btn" onClick={onRetry}>
          もう一度
        </button>
        <button className="btn primary" onClick={onExit}>
          ホームへ
        </button>
      </div>
    </div>
  )
}
