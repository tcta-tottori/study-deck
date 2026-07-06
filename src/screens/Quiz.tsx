import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { buildQueue } from '../srs/srs'
import { recordAnswer, saveNote, saveAiExplanation } from '../lib/study'
import { generateExplanation } from '../lib/ai'
import { getSettings } from '../db/db'
import { categoryLabel, type Question } from '../types'
import { categoryColor } from '../lib/categoryMap'
import { formatClock } from '../lib/dateutil'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { BrandIcon } from '../components/BrandIcon'
import { useTodayProgress } from '../hooks/useAppData'
import { buildAiPrompt, aiServiceUrl, copyText, AI_SERVICES, type AiService } from '../lib/askAi'

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
  const touchStartX = useRef<number | null>(null)
  // 採点の二重実行ガード（setChosen は非同期のため、連打で recordAnswer が
  // 2回走り回答数が実際より増える不具合を同期的に防ぐ）
  const answeringRef = useRef(false)

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
    if (answered || answeringRef.current || !current) return
    answeringRef.current = true
    setChosen(i)
    const correct = await recordAnswer(current, i)
    setAnsweredCount((c) => c + 1)
    if (correct) setCorrectCount((c) => c + 1)
    // 更新後のboxを表示
    const rec = await db.studyRecords.get(current.id)
    setBox(rec?.box ?? null)
  }

  function next() {
    answeringRef.current = false
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

  const correct = answered && chosen === current.answerIndex
  const catCol = categoryColor(current.category)

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!answered || touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx < -60) next() // 採点後のみ左スワイプで次へ
    touchStartX.current = null
  }

  return (
    <div className="quiz" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* 上部：固定（終了・進捗・カテゴリ・今日の目標バー） */}
      <div className="quiz-top">
        <div className="quiz-meta">
          <button className="quiz-exit" onClick={onExit}>
            × 終了
          </button>
          <span className="quiz-qno">{answeredCount + 1}問目</span>
          {config.timeboxSec ? (
            <span className={`exam-timer ${remaining <= 30 ? 'danger' : ''}`}>
              {formatClock(remaining)}
            </span>
          ) : (
            <span className="chip cat" style={{ background: catCol, color: '#fff' }}>
              {categoryLabel(current.category)}
            </span>
          )}
        </div>
        <GoalMeter />
      </div>

      {/* 中央：問題文＋選択肢（長ければスクロール）。採点後は少し暗くして解説へ集中させる */}
      <div className={`quiz-scroll${answered ? ' answered' : ''}`}>
        <div className="stem">{current.stem}</div>
        <div className="choices">
          {current.choices.map((c, i) => {
            let cls = 'choice'
            if (answered) {
              if (i === current.answerIndex) cls += ' correct'
              else if (i === chosen) cls += ' wrong'
              else cls += ' dimmed'
            }
            return (
              <button key={i} className={cls} disabled={answered} onClick={() => choose(i)}>
                <span className="mark">{CHOICE_LETTERS[i]}</span>
                <span>{c}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 下部：解説シート（スクロールせず常に見える） */}
      {answered && (
        <Explanation
          key={current.id}
          question={current}
          correct={correct}
          box={box}
          onNext={next}
          toast={toast}
        />
      )}
    </div>
  )
}

function ResultLike({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="quiz quiz-center">
      <h1 style={{ fontSize: 20, textAlign: 'center', marginBottom: 8 }}>{title}</h1>
      <div style={{ padding: '0 4px' }}>{children}</div>
    </div>
  )
}

/** 回答中に今日の目標達成度をフローティングウィンドウでリアルタイム表示（回答するたび更新） */
function GoalMeter() {
  const { count, goal } = useTodayProgress()
  const pct = Math.min(100, Math.round((count / goal) * 100))
  const done = count >= goal
  // 表示直後は幅0で描画し、少し置いてから現在値へ切り替えて「0→現在」を滑らかに伸ばす。
  // フローティングウィンドウの出現アニメの後にゲージが伸びるよう、わずかに遅延させて段階的に見せる。
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 260)
    return () => clearTimeout(t)
  }, [])
  const width = grown ? `${pct}%` : '0%'
  return (
    <div className="goalmeter floating">
      <div className="goalmeter-label">
        今日の目標 {count}/{goal}
        {done && ' 達成🎉'}
      </div>
      <div className="goalmeter-bar">
        <span style={{ width, background: done ? 'var(--correct)' : 'var(--primary)' }} />
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

  // 問題内容を詳しく説明してもらうプロンプトを用意し、AIアプリ/サイトを開く。
  // プロンプトは必ずクリップボードへコピーしておき、自動入力されない場合も貼り付けられるようにする。
  async function askAi(service: AiService) {
    const prompt = buildAiPrompt(question)
    // クリックのユーザー操作コンテキストを保つため、コピーは待たずに発火してから開く
    void copyText(prompt)
    window.open(aiServiceUrl(service, prompt), '_blank', 'noopener,noreferrer')
    toast('プロンプトをコピーしました。開いたアプリのチャット欄に貼り付けても質問できます。')
  }

  async function copyAiPrompt() {
    const ok = await copyText(buildAiPrompt(question))
    toast(ok ? 'プロンプトをコピーしました。AIアプリに貼り付けてください。' : 'コピーに失敗しました')
  }

  return (
    <div className="quiz-sheet">
      <div className="sheet-body">
        <div className={`verdict ${correct ? 'ok' : 'ng'}`}>
          {correct ? '正解！' : '不正解'}
          {box && (
            <span className="chip box" style={{ marginLeft: 10 }}>
              box {box}
            </span>
          )}
        </div>
        {/* アプリ内の回答表示：解説が無い問題でも必ず正解を提示する */}
        <div className="answer">
          <span className="answer-label">正解</span>
          <span className="answer-choice">
            {CHOICE_LETTERS[question.answerIndex]}．{question.choices[question.answerIndex]}
          </span>
        </div>
        {question.explanation && <p className="answer-exp">{question.explanation}</p>}

        {/* AIアプリで詳しい解説を確認（API不要・アプリ/サイトを開いて質問） */}
        <div className="ai-ask">
          <div className="ai-ask-head">
            <Icon name="sparkle" size={15} />
            AIに詳しく聞く
          </div>
          <div className="ai-ask-btns">
            {AI_SERVICES.map((s) => (
              <button key={s.key} className={`ai-chip brand-${s.key}`} onClick={() => askAi(s.key)}>
                <BrandIcon name={s.key} size={16} />
                {s.label}
              </button>
            ))}
            <button className="ai-chip ghost" onClick={copyAiPrompt} aria-label="プロンプトをコピー">
              <Icon name="copy" size={15} /> コピー
            </button>
          </div>
        </div>

        {ai && (
          <p style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <strong>AI解説：</strong>
            {ai}
          </p>
        )}
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
    </div>
  )
}
