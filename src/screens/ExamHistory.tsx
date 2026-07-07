import { useMemo, useState } from 'react'
import { useExamResults, useQuestions } from '../hooks/useAppData'
import { BackHome } from '../components/BackHome'
import { ExamReview } from '../components/ExamReview'
import { Icon } from '../components/Icon'
import type { QuizConfig } from './Quiz'

/** 受験日時（ローカル）を「M/D HH:mm」で表示 */
function formatTakenAt(ts: number): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts))
}

export default function ExamHistory({
  onHome,
  onReview,
}: {
  onHome: () => void
  onReview: (cfg: QuizConfig) => void
}) {
  const exams = useExamResults() // takenAt 昇順
  const questions = useQuestions()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const byId = useMemo(
    () => new Map((questions ?? []).map((q) => [q.id, q])),
    [questions],
  )

  const list = useMemo(() => (exams ? [...exams].reverse() : []), [exams]) // 新しい順

  const selected = selectedId != null ? list.find((e) => e.id === selectedId) : undefined

  // --- 詳細ビュー ---
  if (selected) {
    const resolved = selected.questionIds.map((id) => byId.get(id))
    return (
      <>
        <header className="appbar">
          <button className="backhome" onClick={() => setSelectedId(null)} aria-label="一覧へ戻る">
            <Icon name="arrow" size={16} strokeWidth={2} className="backhome-arrow-flip" />
            <span>一覧</span>
          </button>
          <h1>試験結果の詳細</h1>
        </header>
        <div className="screen" style={{ paddingTop: 8 }}>
          <div className="exam-result-label muted">
            {selected.label ?? '本番シミュレーション'}・{formatTakenAt(selected.takenAt)}
          </div>
          <ExamReview
            result={selected}
            questions={resolved}
            onStartReview={(s) => onReview({ questionIds: s.questionIds, title: s.title })}
            footer={
              <div className="nextbar" style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={() => setSelectedId(null)}>
                  一覧へ戻る
                </button>
              </div>
            }
          />
        </div>
      </>
    )
  }

  // --- 一覧ビュー ---
  return (
    <>
      <header className="appbar">
        <BackHome onClick={onHome} />
        <h1>受験履歴・復習</h1>
      </header>
      <div className="screen">
        {exams && exams.length === 0 && (
          <div className="empty">
            まだ受験記録がありません。<br />
            本番シミュレーションを受けると、ここで1回ごとに結果を見返せます。
          </div>
        )}
        <div className="exam-hist-list">
          {list.map((e) => (
            <button key={e.id} className="exam-hist-row" onClick={() => setSelectedId(e.id!)}>
              <span className="exam-hist-main">
                <span className="exam-hist-title">{e.label ?? '本番シミュレーション'}</span>
                <span className="exam-hist-sub muted">
                  {formatTakenAt(e.takenAt)}・{e.correct}/{e.total}問正解
                </span>
              </span>
              <span className="exam-hist-right">
                <span className="exam-hist-score">{e.score}</span>
                <span className={`badge sm ${e.passed ? 'pass' : 'fail'}`}>
                  {e.passed ? '合格' : '不合格'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
