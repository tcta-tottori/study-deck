import { useRef, useState } from 'react'
import { CSV_TEMPLATE, importFromCsv, importFromJson, type ImportReport } from '../db/importQuestions'
import { useQuestions } from '../hooks/useAppData'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'

export default function ImportScreen() {
  const toast = useToast()
  const questions = useQuestions()
  const [report, setReport] = useState<ImportReport | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const officialCount = (questions ?? []).filter((q) => q.origin === 'official').length
  const originalCount = (questions ?? []).filter((q) => q.origin === 'original').length

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const rep = file.name.toLowerCase().endsWith('.csv')
      ? await importFromCsv(text)
      : await importFromJson(text)
    setReport(rep)
    if (rep.added + rep.updated > 0) toast(`${rep.added}件追加・${rep.updated}件更新`)
    if (fileRef.current) fileRef.current.value = ''
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
        <h1>問題インポート</h1>
      </header>
      <div className="screen">
        <div className="statrow">
          <div className="stat">
            <div className="num">{officialCount}</div>
            <div className="lbl">公式（取込）</div>
          </div>
          <div className="stat">
            <div className="num">{originalCount}</div>
            <div className="lbl">オリジナル</div>
          </div>
        </div>

        <div className="card">
          <h2>公式過去問の取り込み</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            CSV または JSON を選択してください。データは端末内（IndexedDB）にのみ保存され、
            外部送信されません。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
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
        </div>

        {report && (
          <div className="card">
            <h2>取込結果</h2>
            <p>
              追加 <strong>{report.added}</strong> 件／更新 <strong>{report.updated}</strong> 件／
              有効 {report.total} 件
            </p>
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

        <div className="card">
          <h2>CSVの列</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            id, category, subcategory, stem, choice1〜4, answerIndex, explanation, source
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            ・answerIndex は 0〜3（1〜4表記も自動補正）<br />
            ・category は7分類（製品企画・設計管理／生産システム・生産計画／品質管理／原価管理／納期管理／安全衛生管理／環境管理）。旧14分類の値も自動変換します<br />
            ・id 重複や answerIndex 範囲外は自動で弾きます
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
