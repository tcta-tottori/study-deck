import { useRef, useState } from 'react'
import {
  CSV_TEMPLATE,
  importFromCsv,
  importFromJson,
  mergeReports,
  resetOfficialQuestions,
  type ImportReport,
} from '../db/importQuestions'
import { useQuestions, useSettings } from '../hooks/useAppData'
import { updateSettings } from '../db/db'
import { getSubject } from '../lib/subjects'
import { listSessions } from '../lib/exam'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { BackHome } from '../components/BackHome'
import BackupPanel from '../components/BackupPanel'

export default function ImportScreen({ onHome }: { onHome: () => void }) {
  const toast = useToast()
  const questions = useQuestions()
  const settings = useSettings()
  const subject = getSubject(settings.subjectId)
  const [report, setReport] = useState<ImportReport | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const officialCount = (questions ?? []).filter((q) => q.origin === 'official').length
  const sessionCount = listSessions(questions ?? []).length

  // 複数ファイルをまとめて選べる（例: 営業3級の5回分を一度に）
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const reps: ImportReport[] = []
    for (const file of files) {
      const text = await file.text()
      const r = file.name.toLowerCase().endsWith('.csv') ? await importFromCsv(text) : await importFromJson(text)
      reps.push(files.length > 1 ? { ...r, errors: r.errors.map((m) => `${file.name} ${m}`) } : r)
    }
    const rep = mergeReports(reps)
    setReport(rep)
    if (rep.added + rep.updated > 0) toast(`${rep.added}件追加・${rep.updated}件更新`)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onReset() {
    if (officialCount === 0) {
      toast('取込済みの公式問題はありません')
      return
    }
    if (
      !confirm(
        `${subject.name}の取込済み問題 ${officialCount}問 をすべて削除します（他の科目の問題は残ります）。\n学習履歴（SRS・連続日数・模試結果）は削除されません。同じデータを取り込み直せば履歴もそのまま復活します。\n\n削除してよろしいですか？`,
      )
    )
      return
    const n = await resetOfficialQuestions(subject.id)
    setReport(null)
    toast(`公式問題 ${n}問 を削除しました`)
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'questions_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <header className="appbar">
        <BackHome onClick={onHome} />
        <h1>取込</h1>
      </header>
      <div className="screen">
        <div className="statrow">
          <div className="stat">
            <div className="num">{officialCount}</div>
            <div className="lbl">取込問題数（{subject.short ?? subject.name}）</div>
          </div>
          <div className="stat">
            <div className="num">{sessionCount}</div>
            <div className="lbl">受験可能な回</div>
          </div>
        </div>

        <div className="card">
          <h2>公式過去問の取り込み</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            CSV または JSON を選択してください（複数ファイルをまとめて選べます）。データは端末内（IndexedDB）にのみ保存され、
            外部送信されません。JSON に subjectId（例: eigyo-3／marketing-3）があればその科目へ、無ければ
            いま選んでいる科目（{subject.name}）へ入ります。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
            multiple
            onChange={onFile}
            style={{ display: 'none' }}
          />
          <button
            className="btn primary"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="import" size={18} /> ファイルを選択
          </button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={downloadTemplate}>
            CSVテンプレートをダウンロード
          </button>
          <button
            className="btn ghost"
            style={{ marginTop: 10, color: 'var(--wrong)' }}
            onClick={onReset}
            disabled={officialCount === 0}
          >
            取込データをリセット（{officialCount}問）
          </button>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            ※ リセットは取り込んだ問題だけを削除します。学習履歴・連続日数・模試結果は残るため、
            取り込み直せば履歴もそのまま使えます。
          </p>
        </div>

        {report && (
          <div className="card">
            <h2>取込結果</h2>
            <p>
              追加 <strong>{report.added}</strong> 件／更新 <strong>{report.updated}</strong> 件／
              有効 {report.total} 件
            </p>
            {report.bySubject && Object.keys(report.bySubject).length > 0 && (
              <div style={{ margin: '8px 0' }}>
                {Object.entries(report.bySubject).map(([sid, n]) => {
                  const s = getSubject(sid)
                  const here = s.id === subject.id
                  return (
                    <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', flexWrap: 'wrap' }}>
                      <span>
                        {s.name}：<strong>{n}</strong> 問
                      </span>
                      {here ? (
                        <span className="muted" style={{ fontSize: 12 }}>（学習中の科目）</span>
                      ) : (
                        <button
                          className="btn ghost sm"
                          onClick={() => {
                            void updateSettings({ subjectId: s.id })
                            toast(`科目を「${s.name}」に切り替えました`)
                          }}
                        >
                          この科目で学習する
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {report.notesRestored > 0 && (
              <p style={{ color: 'var(--correct)' }}>
                バックアップから復元待ちだったメモ {report.notesRestored} 件を、この取込で反映しました。
              </p>
            )}
            {report.errors.length > 0 ? (
              <>
                <p style={{ color: 'var(--wrong)', fontWeight: 700 }}>
                  エラー {report.errors.length} 件（該当行は取り込まれていません）
                </p>
                <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                  {report.errors.slice(0, 20).map((e, i) => (
                    <li key={i} style={{ color: 'var(--wrong)' }}>
                      {e}
                    </li>
                  ))}
                  {report.errors.length > 20 && <li>…ほか {report.errors.length - 20} 件</li>}
                </ul>
              </>
            ) : (
              <p style={{ color: 'var(--correct)' }}>✅ すべて正常に取り込みました。</p>
            )}
          </div>
        )}

        <BackupPanel />

        <div className="card">
          <h2>CSVの列</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            id, category, subcategory, stem, choice1〜4, answerIndex, explanation, source
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            ・answerIndex は 0〜3（1〜4表記も自動補正）<br />
            ・category は{subject.name}の分類（{subject.categories.join('／')}）
            {subject.id === 'seisan-kanri-planning-3' ? '。旧14分類の値も自動変換します' : ''}
            <br />
            ・id 重複や answerIndex 範囲外は自動で弾きます<br />
            ・JSONでは figure に図（viewBox付きの SVG）を入れられます。
            {' { "id": "OFF-…", "figure": "<svg …>" } '}
            だけの行を取り込むと、取込済みの問題に図だけを追加します
          </p>
          <hr className="sep" />
          <p className="muted" style={{ fontSize: 12 }}>
            ⚠️ 公式過去問は「禁転載複製」です。個人学習の範囲で利用し、取込データは公開リポジトリに
            コミットしないでください（.gitignore 済み）。
          </p>
        </div>
      </div>
    </>
  )
}
