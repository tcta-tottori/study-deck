import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { buildQueue } from '../srs/srs'
import { recordAnswer, saveNote, saveAiExplanation } from '../lib/study'
import { generateExplanation } from '../lib/ai'
import { getSettings } from '../db/db'
import { categoryLabel, type Question } from '../types'
import { formatClock } from '../lib/dateutil'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { useTodayProgress } from '../hooks/useAppData'

export interface QuizConfig {
  limit?: number
  timeboxSec?: number
  wrongOnly?: boolean
  categories?: string[]
}

const CHOICE_LETTERS = ['ア', 'イ', 'ウ', 'エ']

export default function Quiz({ config, onExit }: { config: QuizConfig; onExit: () => void }) {
  const toast = useToast()
  const [queue, setQueue] = useState<Question[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [box, setBox] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(config.timeboxSec ?? 0)
  const [timeUp, setTimeUp] = useState(false)

  // 起動時にキューをスナップショット構築（即表示：ゼロ摩擦）
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [questions, recs] = await Promise.all([
        db.questions.toArray(),
        db.studyRecords.toArray(),
      ])
      const map = new Map(recs.map((r) => [r.questionId, r]))
      // インターリービング既定ON = カテゴリ絞りなし。config.categories 指定時のみ絞る。
      const q = buildQueue(questions, map, {
        now: Date.now(),
        categories: config.categories,
        wrongOnly: config.wrongOnly,
        limit: config.limit,
      })
      if (alive) setQueue(q)
    })()
    return () => {
      alive = false
    }
  }, [config])

  // タイムボックス（3分など）
  useEffect(() => {
    if (!config.timeboxSec) return
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t)
          setTimeUp(true)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [config.timeboxSec])

  const current = queue && idx < queue.length ? queue[idx] : null
  const answered = chosen !== null

  async function choose(i: number) {
    if (answered || !current) return
    setChosen(i)
    const correct = await recordAnswer(current, i)
    setAnsweredCount((c) => c + 1)
    if (correct) setCorrectCount((c) => c + 1)
    // 更新後のboxを表示
    const rec = await db.studyRecords.get(current.id)
    setBox(rec?.box ?? null)
  }

  function next() {
    setChosen(null)
    setBox(null)
    setIdx((i) => i + 1)
  }

  // 中断に強い：終了/完走判定。
  // 出題数の上限はキュー長（buildQueueでlimitにスライス済み）で担保するため、
  // 最終問の採点直後に打ち切らず、解説を見て「次へ」で進めてから終了する。
  const done = timeUp || (queue !== null && idx >= queue.length)

  if (queue === null) {
    return (
      <div className="quiz">
        <div className="empty">読み込み中…</div>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <ResultLike title="出題できる問題がありません">
        <p className="muted">
          {config.wrongOnly
            ? 'box1・2の問題がありません。まずは通常モードで学習しましょう。'
            : '条件に合う問題がありません。'}
        </p>
        <button className="btn primary" onClick={onExit}>
          ホームへ
        </button>
      </ResultLike>
    )
  }

  if (done || !current) {
    const acc = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
    return (
      <ResultLike title="セッション終了">
        <div className="statrow" style={{ marginBottom: 16 }}>
          <div className="stat">
            <div className="num">{answeredCount}</div>
            <div className="lbl">回答</div>
          </div>
          <div className="stat">
            <div className="num">{correctCount}</div>
            <div className="lbl">正解</div>
          </div>
          <div className="stat">
            <div className="num">{acc}%</div>
            <div className="lbl">正答率</div>
          </div>
        </div>
        <button className="btn primary" onClick={onExit}>
          ホームへ戻る
        </button>
      </ResultLike>
    )
  }

  return (
    <QuizCard
      key={current.id}
      question={current}
      chosen={chosen}
      box={box}
      answered={answered}
      progressText={`${answeredCount + 1}問目`}
      remainingText={config.timeboxSec ? formatClock(remaining) : undefined}
      onChoose={choose}
      onNext={next}
      onExit={onExit}
      toast={toast}
    />
  )
}

function ResultLike({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="quiz">
      <div className="quiz-top">
        <h1 style={{ fontSize: 20, marginTop: 24 }}>{title}</h1>
      </div>
      <div className="quiz-spacer" />
      <div style={{ padding: '0 4px' }}>{children}</div>
    </div>
  )
}

function QuizCard({
  question,
  chosen,
  box,
  answered,
  progressText,
  remainingText,
  onChoose,
  onNext,
  onExit,
  toast,
}: {
  question: Question
  chosen: number | null
  box: number | null
  answered: boolean
  progressText: string
  remainingText?: string
  onChoose: (i: number) => void
  onNext: () => void
  onExit: () => void
  toast: (m: React.ReactNode) => void
}) {
  const correct = answered && chosen === question.answerIndex
  const touchStartX = useRef<number | null>(null)

  // 採点後のみスワイプで次へ（採点前のスワイプは無効＝誤爆防止）
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!answered || touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx < -60) onNext() // 左スワイプで次へ
    touchStartX.current = null
  }

  return (
    <div className="quiz" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="quiz-top">
        <div className="quiz-meta">
          <button className="quiz-exit" onClick={onExit}>
            × 終了
          </button>
          <span>{progressText}</span>
          {remainingText ? (
            <span className="exam-timer">{remainingText}</span>
          ) : (
            <span className="chip">{categoryLabel(question.category)}</span>
          )}
        </div>
        <GoalMeter />
        <div className="stem">{question.stem}</div>
      </div>

      <div className="quiz-spacer" />

      <div className="choices">
        {question.choices.map((c, i) => {
          let cls = 'choice'
          if (answered) {
            if (i === question.answerIndex) cls += ' correct'
            else if (i === chosen) cls += ' wrong'
            else cls += ' dimmed'
          }
          return (
            <button key={i} className={cls} disabled={answered} onClick={() => onChoose(i)}>
              <span className="mark">{CHOICE_LETTERS[i]}</span>
              <span>{c}</span>
            </button>
          )
        })}
      </div>

      {answered && (
        <Explanation
          question={question}
          correct={correct}
          box={box}
          onNext={onNext}
          toast={toast}
        />
      )}
    </div>
  )
}

/** 回答中に今日の目標達成度をリアルタイム表示（回答するたび更新） */
function GoalMeter() {
  const { count, goal } = useTodayProgress()
  const pct = Math.min(100, Math.round((count / goal) * 100))
  const done = count >= goal
  return (
    <div className="goalmeter">
      <div className="goalmeter-bar">
        <span style={{ width: `${pct}%`, background: done ? 'var(--correct)' : 'var(--primary)' }} />
      </div>
      <div className="goalmeter-label">
        今日の目標 {count}/{goal}
        {done && ' 達成🎉'}
      </div>
    </div>
  )
}

function Explanation({
  question,
  correct,
  box,
  onNext,
  toast,
}: {
  question: Question
  correct: boolean
  box: number | null
  onNext: () => void
  toast: (m: React.ReactNode) => void
}) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState(question.note ?? '')
  const [ai, setAi] = useState(question.aiExplanation ?? '')
  const [aiLoading, setAiLoading] = useState(false)
  const [hasKey, setHasKey] = useState(false)

  useEffect(() => {
    getSettings().then((s) => setHasKey(!!s.anthropicApiKey))
  }, [])

  async function genAi() {
    setAiLoading(true)
    try {
      const s = await getSettings()
      if (!s.anthropicApiKey) return
      const text = await generateExplanation(question, s.anthropicApiKey)
      setAi(text)
      await saveAiExplanation(question.id, text)
    } catch (e) {
      toast(`AI解説の生成に失敗しました`)
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  async function persistNote() {
    await saveNote(question.id, note)
    setShowNote(false)
    toast('メモを保存しました')
  }

  return (
    <div className="explain">
      <div className={`verdict ${correct ? 'ok' : 'ng'}`}>
        {correct ? '正解！' : '不正解'}
        {box && <span className="chip box" style={{ marginLeft: 10 }}>box {box}</span>}
      </div>
      {question.explanation && <p>{question.explanation}</p>}
      {ai && (
        <p style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <strong>AI解説：</strong>
          {ai}
        </p>
      )}

      <div className="nextbar">
        <button className="btn primary" onClick={onNext}>
          次へ →
        </button>
        <button
          className="btn sm"
          aria-label="メモ"
          style={{ display: 'inline-flex', alignItems: 'center' }}
          onClick={() => setShowNote((v) => !v)}
        >
          <Icon name="pencil" size={18} />
        </button>
        {hasKey && !ai && (
          <button className="btn sm" onClick={genAi} disabled={aiLoading}>
            {aiLoading ? '…' : 'AI'}
          </button>
        )}
      </div>

      {showNote && (
        <div style={{ marginTop: 10 }}>
          <textarea
            placeholder="誤答ノート（自分用メモ）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn sm primary" style={{ marginTop: 6 }} onClick={persistNote}>
            保存
          </button>
        </div>
      )}
    </div>
  )
}
