import { useCallback, useEffect, useRef, useState } from 'react'
import {
  db,
  getSettings,
  getExamProgress,
  saveExamProgress,
  clearExamProgress,
} from '../db/db'
import { recordAnswer } from '../lib/study'
import { type ExamProgress, type ExamResult, type Question } from '../types'
import type { QuizConfig } from './Quiz'
import { formatClock, formatDuration } from '../lib/dateutil'
import { Icon } from '../components/Icon'
import { ExamReview } from '../components/ExamReview'
import { listSessions, questionsForSession, pickBalanced, type ExamSession } from '../lib/exam'

const LETTERS = ['ア', 'イ', 'ウ', 'エ']
const EXAM_N = 40
const PASS_RATIO = 0.6 // 6割で合格

type StartMode = { mode: 'random' } | { mode: 'session'; key: string }

type Phase = 'intro' | 'running' | 'result'

export default function Exam({
  onExit,
  onReview,
}: {
  onExit: () => void
  onReview: (cfg: QuizConfig) => void
}) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [cur, setCur] = useState(0)
  const [durationSec, setDurationSec] = useState(110 * 60)
  const [elapsed, setElapsed] = useState(0) // 経過秒（カウントアップ）
  const [label, setLabel] = useState('')
  const [result, setResult] = useState<ExamResult | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [resume, setResume] = useState<ExamProgress | undefined>(undefined)
  const available = allQuestions.length

  // 経過時間は「これまでの累計（accumulated）＋現セグメント開始からの実時間」で算出。
  // バックグラウンド化でタイマーが止まっても、復帰時に壁時計から正しく計算できる。
  const accumulatedRef = useRef(0)
  const segStartRef = useRef(0)
  const submittedRef = useRef(false)
  // 中断保存で最新の state を参照するためのミラー
  const stateRef = useRef({ questions, answers, cur, label, durationSec })
  const phaseRef = useRef<Phase>('intro')

  useEffect(() => {
    stateRef.current = { questions, answers, cur, label, durationSec }
  }, [questions, answers, cur, label, durationSec])
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const computeElapsed = useCallback(
    () => accumulatedRef.current + Math.floor((Date.now() - segStartRef.current) / 1000),
    [],
  )

  useEffect(() => {
    getSettings().then((s) => {
      setDurationSec(s.examDurationSec)
    })
    db.questions.toArray().then((all) => {
      setAllQuestions(all)
      setSessions(listSessions(all))
    })
    getExamProgress().then((p) => setResume(p))
  }, [])

  // 中断保存（最新 state をミラーから読む）
  const saveProgressNow = useCallback(async () => {
    const st = stateRef.current
    if (st.questions.length === 0) return
    const progress: Omit<ExamProgress, 'id'> = {
      label: st.label,
      questionIds: st.questions.map((q) => q.id),
      answers: st.answers,
      cur: st.cur,
      elapsedSec: computeElapsed(),
      durationSec: st.durationSec,
      savedAt: Date.now(),
    }
    await saveExamProgress(progress)
  }, [computeElapsed])

  // 経過時間のカウントアップ（自動提出はしない＝計画時間は目安）
  useEffect(() => {
    if (phase !== 'running') return
    setElapsed(computeElapsed())
    const t = setInterval(() => setElapsed(computeElapsed()), 500)
    return () => clearInterval(t)
  }, [phase, computeElapsed])

  // 回答・移動のたびに進捗を自動保存（不意の離脱でも「続きから」できる）
  useEffect(() => {
    if (phase !== 'running') return
    void saveProgressNow()
  }, [answers, cur, phase, saveProgressNow])

  // バックグラウンド化・タブ離脱でも保存（経過時間の取りこぼしを防ぐ）
  useEffect(() => {
    const onHide = () => {
      if (phaseRef.current === 'running') void saveProgressNow()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [saveProgressNow])

  function labelFor(opts: StartMode, count: number): string {
    if (opts.mode === 'session') {
      return sessions.find((s) => s.key === opts.key)?.label ?? '過去問'
    }
    return `全分野バランス ${count}問`
  }

  async function start(opts: StartMode) {
    const picked =
      opts.mode === 'session'
        ? questionsForSession(allQuestions, opts.key)
        : pickBalanced(allQuestions, EXAM_N)
    if (picked.length === 0) return
    await clearExamProgress() // 新規開始時は中断中の回を破棄（1件のみ保持）
    setResume(undefined)
    setQuestions(picked)
    setAnswers(new Array(picked.length).fill(-1))
    setCur(0)
    setLabel(labelFor(opts, picked.length))
    accumulatedRef.current = 0
    segStartRef.current = Date.now()
    setElapsed(0)
    submittedRef.current = false
    setPhase('running')
  }

  function resumeExam(p: ExamProgress) {
    const byId = new Map(allQuestions.map((q) => [q.id, q]))
    // 問題が欠損している場合はその組を（回答ごと）除外して整合を保つ
    const pairs = p.questionIds
      .map((id, i) => ({ q: byId.get(id), a: p.answers[i] ?? -1 }))
      .filter((x): x is { q: Question; a: number } => !!x.q)
    if (pairs.length === 0) {
      void clearExamProgress()
      setResume(undefined)
      return
    }
    setQuestions(pairs.map((x) => x.q))
    setAnswers(pairs.map((x) => x.a))
    setCur(Math.min(p.cur, pairs.length - 1))
    setDurationSec(p.durationSec)
    setLabel(p.label)
    accumulatedRef.current = p.elapsedSec
    segStartRef.current = Date.now()
    setElapsed(p.elapsedSec)
    submittedRef.current = false
    setResume(undefined)
    setPhase('running')
  }

  async function discardResume() {
    if (!confirm('中断中の試験を破棄します。よろしいですか？')) return
    await clearExamProgress()
    setResume(undefined)
  }

  function pick(choice: number) {
    setAnswers((a) => {
      const next = a.slice()
      next[cur] = choice
      return next
    })
  }

  // 中断：進捗を保存してホームへ（あとで続きから再開できる）
  async function suspend() {
    await saveProgressNow()
    onExit()
  }

  // 終了：今の回答で採点して結果画面へ
  async function submit() {
    if (submittedRef.current) return
    submittedRef.current = true
    const durationSecTaken = computeElapsed()

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
      label,
    }
    const id = await db.examResults.add(res)
    await clearExamProgress() // 採点済みなので中断状態は破棄
    setResult({ ...res, id })
    setPhase('result')
  }

  if (phase === 'intro') {
    const mins = Math.round(durationSec / 60)
    const randomN = Math.min(EXAM_N, available)
    const resumeAnswered = resume ? resume.answers.filter((a) => a >= 0).length : 0
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
          {/* 中断中の回があれば最上部に「続きから再開」カード */}
          {resume && (
            <div className="card resume-card">
              <div className="resume-head">
                <Icon name="timer" size={18} />
                中断中の試験があります
              </div>
              <div className="resume-body">
                <div className="resume-title">{resume.label}</div>
                <div className="muted resume-sub">
                  {resumeAnswered}/{resume.questionIds.length}問 回答済・経過{' '}
                  {formatClock(resume.elapsedSec)}
                </div>
              </div>
              <div className="resume-actions">
                <button className="btn primary sm" onClick={() => resumeExam(resume)}>
                  続きから再開
                </button>
                <button className="btn ghost sm" onClick={discardResume}>
                  破棄
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <h2>本番形式（4択・6割で合格）</h2>
            <p className="muted" style={{ margin: 0 }}>
              計画時間 {mins}分（目安・超過しても続行できます）／試験中は正誤非表示（提出後に採点）。
              総取込 {available}問。
            </p>
          </div>

          <div className="sec-head">
            <h2>ランダム出題</h2>
          </div>
          <button
            className="exam-card"
            disabled={available === 0}
            onClick={() => void start({ mode: 'random' })}
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
                  onClick={() => void start({ mode: 'session', key: s.key })}
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
    const over = elapsed > durationSec
    const answeredCount = answers.filter((a) => a >= 0).length
    return (
      <div className="quiz">
        <div className="quiz-top">
          <div className="quiz-meta exam-run-meta">
            <button className="btn ghost sm" onClick={() => void suspend()}>
              中断
            </button>
            <span className="exam-qno">
              {cur + 1} / {questions.length}
            </span>
            <button className="btn ghost sm" onClick={() => void submit()}>
              終了
            </button>
          </div>
          <div className="exam-timer-row">
            <span className={`exam-timer ${over ? 'danger' : ''}`}>
              経過 {formatClock(elapsed)} <span className="exam-timer-sep">/</span> 計画{' '}
              {formatClock(durationSec)}
            </span>
            {over && <span className="exam-over">計画時間を超過中</span>}
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
              終了して採点（{answeredCount}/{questions.length}）
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
    <div className="screen" style={{ paddingTop: 16 }}>
      {label && <div className="exam-result-label muted">{label}・所要 {formatDuration(result!.durationSec)}</div>}
      <ExamReview
        result={result!}
        questions={questions}
        onStartReview={(s) => onReview({ questionIds: s.questionIds, title: s.title })}
        footer={
          <div className="nextbar" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => setPhase('intro')}>
              もう一度
            </button>
            <button className="btn primary" onClick={onExit}>
              ホームへ
            </button>
          </div>
        }
      />
    </div>
  )
}
