import { useEffect, useMemo, useRef, useState } from 'react'
import { db, getSettings } from '../db/db'
import { shuffle } from '../srs/srs'
import { recordAnswer } from '../lib/study'
import { categoryLabel, type ExamResult, type Question } from '../types'
import { formatClock, formatDuration } from '../lib/dateutil'

const LETTERS = ['ア', 'イ', 'ウ', 'エ']
const EXAM_N = 40
const PASS_N = 24

type Phase = 'intro' | 'running' | 'result'

export default function Exam({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [cur, setCur] = useState(0)
  const [durationSec, setDurationSec] = useState(110 * 60)
  const [remaining, setRemaining] = useState(110 * 60)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [available, setAvailable] = useState(0)
  const startedAt = useRef(0)
  const submittedRef = useRef(false)

  useEffect(() => {
    getSettings().then((s) => {
      setDurationSec(s.examDurationSec)
      setRemaining(s.examDurationSec)
    })
    db.questions.count().then(setAvailable)
  }, [])

  async function start() {
    const all = await db.questions.toArray()
    const official = shuffle(all.filter((q) => q.origin === 'official'))
    const original = shuffle(all.filter((q) => q.origin === 'original'))
    // official優先で40問。不足分はoriginalで補完。
    const picked = [...official, ...original].slice(0, Math.min(EXAM_N, all.length))
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

    const score = Math.round((correct / EXAM_N) * 100 * 10) / 10
    const res: ExamResult = {
      takenAt: Date.now(),
      total: questions.length,
      correct,
      score,
      passed: correct >= PASS_N,
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
        <div className="quiz-spacer" />
        <div className="card">
          <h2>本番形式（4択40問）</h2>
          <p>・{EXAM_N}問／制限時間 {Math.round(durationSec / 60)}分</p>
          <p>・試験中は正誤を表示しません（提出後に採点）</p>
          <p>・合格ライン：{PASS_N}問（60点）</p>
          <p className="muted">
            取り込み済み公式問題を優先出題します（現在の総問題数 {available}問）。
          </p>
        </div>
        <button className="btn primary" disabled={available === 0} onClick={start}>
          {available === 0 ? '問題がありません' : '開始する'}
        </button>
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
