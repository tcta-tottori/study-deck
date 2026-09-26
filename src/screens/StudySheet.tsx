import { useMemo, useRef, useState } from 'react'
import type { QuizConfig } from './Quiz'
import type { Category, Question, StudyRecord } from '../types'
import { CATEGORIES } from '../types'
import { categoryColor } from '../lib/categoryMap'
import {
  buildStudySheet,
  renderSheetHtml,
  sheetFilename,
  type SheetCategory,
  type SheetScope,
} from '../lib/studySheet'
import { BackHome } from '../components/BackHome'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'

/**
 * まとめノート画面。
 * 「項目（カテゴリ）× 間違いが多い問題／全問題」でHTMLの学習資料を組み立て、
 * その場でプレビュー（実際に保存されるHTMLをiframeで表示）・保存・印刷できる。
 */
export default function StudySheet({
  questions,
  records,
  onHome,
  onStartQuiz,
}: {
  questions: Question[]
  records: Map<string, StudyRecord>
  onHome: () => void
  onStartQuiz: (cfg: QuizConfig) => void
}) {
  const toast = useToast()
  const [category, setCategory] = useState<SheetCategory>('all')
  const [scope, setScope] = useState<SheetScope>('weak')
  const [includeChoices, setIncludeChoices] = useState(true)
  const [includeNotes, setIncludeNotes] = useState(true)
  const frameRef = useRef<HTMLIFrameElement>(null)

  // カテゴリ選択チップ用の集計（問題数・正答率・誤答のある問題数）
  const catSummary = useMemo(() => {
    const base = new Map<
      SheetCategory,
      { total: number; weak: number; correct: number; wrong: number }
    >()
    base.set('all', { total: 0, weak: 0, correct: 0, wrong: 0 })
    for (const c of CATEGORIES) base.set(c, { total: 0, weak: 0, correct: 0, wrong: 0 })
    for (const q of questions) {
      const r = records.get(q.id)
      for (const key of ['all', q.category] as SheetCategory[]) {
        const s = base.get(key)
        if (!s) continue
        s.total++
        s.correct += r?.correctCount ?? 0
        s.wrong += r?.wrongCount ?? 0
        if ((r?.wrongCount ?? 0) > 0) s.weak++
      }
    }
    return base
  }, [questions, records])

  const sheet = useMemo(
    () => buildStudySheet(questions, records, { category, scope }),
    [questions, records, category, scope],
  )

  const html = useMemo(() => {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    return renderSheetHtml(sheet, { theme, includeChoices, includeNotes })
  }, [sheet, includeChoices, includeNotes])

  function download() {
    // 保存版はテーマ自動（開いた端末の設定に追従）にする
    const file = renderSheetHtml(sheet, { theme: 'auto', includeChoices, includeNotes })
    const blob = new Blob([file], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = sheetFilename(sheet)
    a.click()
    URL.revokeObjectURL(url)
    toast('まとめノートを保存しました')
  }

  function print() {
    const win = frameRef.current?.contentWindow
    if (!win) return
    try {
      win.focus()
      win.print()
    } catch {
      toast('印刷を開始できませんでした。保存してから開いて印刷してください')
    }
  }

  const empty = sheet.items.length === 0
  const scopeLabel = scope === 'weak' ? '間違いが多い問題' : 'この項目の全問題'

  return (
    <>
      <header className="appbar">
        <BackHome onClick={onHome} />
        <h1>まとめノート</h1>
      </header>

      <div className="screen">
        <div className="card ss-picker">
          <h2>項目を選ぶ</h2>
          <div className="ss-cats">
            {(['all', ...CATEGORIES] as SheetCategory[]).map((c) => {
              const s = catSummary.get(c)
              if (!s || s.total === 0) return null
              const col = c === 'all' ? 'var(--primary)' : categoryColor(c as Category)
              const denom = s.correct + s.wrong
              const acc = denom > 0 ? Math.round((s.correct / denom) * 100) : null
              const active = category === c
              return (
                <button
                  key={c}
                  className={`ss-cat${active ? ' on' : ''}`}
                  style={active ? { background: col, borderColor: col } : { borderColor: col }}
                  onClick={() => setCategory(c)}
                >
                  <span className="ss-cat-name">{c === 'all' ? '全カテゴリ' : c}</span>
                  <span className="ss-cat-sub">
                    {s.total}問
                    {acc !== null ? `・正答${acc}%` : '・未学習'}
                    {s.weak > 0 ? `・誤答${s.weak}` : ''}
                  </span>
                </button>
              )
            })}
          </div>

          <h2 style={{ marginTop: 16 }}>範囲</h2>
          <div className="seg ss-scope">
            <button className={scope === 'weak' ? 'on' : ''} onClick={() => setScope('weak')}>
              間違いが多い問題
            </button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
              項目の全問題
            </button>
          </div>

          <div className="switch" style={{ marginTop: 14, marginBottom: 12 }}>
            <span>選択肢も載せる</span>
            <button
              className={`toggle ${includeChoices ? 'on' : ''}`}
              aria-pressed={includeChoices}
              onClick={() => setIncludeChoices((v) => !v)}
            />
          </div>
          <div className="switch" style={{ marginBottom: 0 }}>
            <span>メモ・補足解説も載せる</span>
            <button
              className={`toggle ${includeNotes ? 'on' : ''}`}
              aria-pressed={includeNotes}
              onClick={() => setIncludeNotes((v) => !v)}
            />
          </div>
        </div>

        {/* 生成結果の見出し＋アクション */}
        <section className="ss-result" style={{ borderColor: sheet.color }}>
          <div className="ss-result-head">
            <span className="ss-chip" style={{ background: sheet.color }}>
              {sheet.categoryLabel}
            </span>
            <span className="ss-result-title">
              {scopeLabel} <b>{sheet.items.length}</b>問
            </span>
          </div>
          <div className="ss-actions">
            <button className="btn primary sm" onClick={download} disabled={empty}>
              <span className="ss-btn-in">
                <Icon name="import" size={17} />
                HTMLで保存
              </span>
            </button>
            <button className="btn sm" onClick={print} disabled={empty}>
              <span className="ss-btn-in">
                <Icon name="clipboard" size={17} />
                印刷・PDF
              </span>
            </button>
            <button
              className="btn sm"
              disabled={empty}
              onClick={() =>
                onStartQuiz({
                  questionIds: sheet.items.map((it) => it.q.id),
                  title: `${sheet.categoryLabel}の${scopeLabel}`,
                })
              }
            >
              <span className="ss-btn-in">
                <Icon name="bolt" size={17} />
                この範囲を解く
              </span>
            </button>
          </div>
          <p className="muted ss-hint">
            {empty
              ? scope === 'weak'
                ? 'この項目で間違えた問題はまだありません。「項目の全問題」に切り替えるか、学習を進めてから作成してください。'
                : 'この項目の問題が取り込まれていません。取込画面から追加してください。'
              : '保存したファイルはブラウザで開けます（通信不要）。印刷ダイアログから「PDFで保存」も選べます。iPhoneで印刷できないときは、保存したファイルを開いて共有メニューからプリントしてください。'}
          </p>
        </section>

        {/* プレビュー（保存されるHTMLそのもの） */}
        <div className="ss-preview">
          <div className="ss-preview-bar">
            <span>プレビュー</span>
            <span className="muted">保存・印刷されるものと同じ内容です</span>
          </div>
          <iframe
            ref={frameRef}
            className="ss-frame"
            title="まとめノートのプレビュー"
            srcDoc={html}
            sandbox="allow-same-origin allow-modals"
          />
        </div>
      </div>
    </>
  )
}
