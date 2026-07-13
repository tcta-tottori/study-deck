import { useMemo, useState } from 'react'
import { categoryLabel, type ExamResult, type Question } from '../types'
import { formatDuration } from '../lib/dateutil'
import { AiAsk } from './AiAsk'
import { ChoiceReasons } from './ChoiceReasons'

const LETTERS = ['ア', 'イ', 'ウ', 'エ']

export interface ReviewStart {
  questionIds: string[]
  title: string
}

/**
 * 試験結果の詳細ビュー（得点・カテゴリ別分析・問題別見直し＋AI解説＋復習開始）。
 * 受験直後の結果画面と、過去の受験履歴の詳細の両方で共用する。
 * questions は result.questionIds を現在のDBで引いたもの（欠損は undefined 穴でも可）。
 */
export function ExamReview({
  result,
  questions,
  onStartReview,
  footer,
}: {
  result: ExamResult
  questions: (Question | undefined)[]
  onStartReview?: (s: ReviewStart) => void
  footer?: React.ReactNode
}) {
  const [reviewOnly, setReviewOnly] = useState(true)

  const items = useMemo(
    () =>
      result.questionIds.map((id, i) => ({
        id,
        q: questions[i],
        answer: result.answers[i] ?? -1,
        idx: i,
      })),
    [result, questions],
  )

  const wrong = items.filter((it) => !it.q || it.answer !== it.q.answerIndex)
  const wrongIds = wrong.map((it) => it.id)
  const allIds = items.map((it) => it.id)
  const list = reviewOnly ? wrong : items

  return (
    <>
      <div className="card result-hero">
        <div className="muted">得点</div>
        <div className="score">{result.score}</div>
        <div className="muted">
          {result.correct} / {result.total} 問正解
        </div>
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
        <h2>カテゴリ別内訳（分析）</h2>
        {Object.entries(result.byCategory)
          .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
          .map(([cat, v]) => {
            const pct = Math.round((v.correct / v.total) * 100)
            return (
              <div className="bar-item" key={cat}>
                <div className="bar-head">
                  <span>{categoryLabel(cat as Question['category'])}</span>
                  <span className="muted">
                    {pct}%（{v.correct}/{v.total}）
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

      {/* この試験の問題で復習セッションを開始（誤答だけ／全問） */}
      {onStartReview && (
        <div className="card">
          <h2>この試験で復習する</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -4, marginBottom: 10 }}>
            出題された問題をそのまま学習モードで解き直せます。
          </p>
          <div className="review-actions">
            <button
              className="btn primary sm"
              disabled={wrongIds.length === 0}
              onClick={() => onStartReview({ questionIds: wrongIds, title: '誤答の復習' })}
            >
              誤答だけ復習（{wrongIds.length}）
            </button>
            <button
              className="btn sm"
              onClick={() => onStartReview({ questionIds: allIds, title: '全問の復習' })}
            >
              全問を復習（{allIds.length}）
            </button>
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between', margin: '4px 4px 12px' }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>見直し</h2>
        <button className="chip" onClick={() => setReviewOnly((v) => !v)}>
          {reviewOnly ? `誤答のみ (${wrong.length})` : '全問'}
        </button>
      </div>

      {list.length === 0 && <div className="empty">全問正解！素晴らしい。</div>}

      {list.map((it) => {
        const q = it.q
        if (!q) {
          return (
            <div className="card" key={it.id}>
              <div className="muted" style={{ marginBottom: 6 }}>
                第{it.idx + 1}問
              </div>
              <p className="muted">この問題は現在のデータに見つかりませんでした（取込のやり直し等）。</p>
            </div>
          )
        }
        const mine = it.answer
        const ok = mine === q.answerIndex
        return (
          <div className="card" key={q.id}>
            <div className="muted" style={{ marginBottom: 6 }}>
              第{it.idx + 1}問・{categoryLabel(q.category)}
              {ok ? (
                <span className="chip inline-ok">正解</span>
              ) : (
                <span className="chip inline-ng">{mine < 0 ? '未回答' : '誤答'}</span>
              )}
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
            {q.explanation && (
              <p style={{ fontSize: 14 }}>
                <span className="answer-exp-label">正解の理由</span>
                {q.explanation}
              </p>
            )}
            {/* 各選択肢がなぜ正解／不正解か（choiceReasons がある問題のみ） */}
            <ChoiceReasons question={q} chosen={mine} />
            {/* AIで詳しく解説してもらう（クイズと共通） */}
            <AiAsk question={q} selectedIndex={mine} compact />
          </div>
        )
      })}

      {footer}
    </>
  )
}
