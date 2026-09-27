import { useEffect, useRef, useState } from 'react'
import { db, updateSettings, pendingNotesCount, applyPendingNotes } from '../db/db'
import { useSettings } from '../hooks/useAppData'
import { exportBackupJson, backupFilename, restoreBackup, type RestoreReport } from '../lib/backup'
import { useToast } from './Toast'

/**
 * 学習データのバックアップ／復元／リセット。
 * 問題の取込と並べて置けるよう、取込ページから使うパネルとして切り出している。
 */
export default function BackupPanel() {
  const toast = useToast()
  const settings = useSettings()
  const includeQuestions = settings?.backupIncludeQuestions !== false
  const restoreRef = useRef<HTMLInputElement>(null)
  // 復元の結果は画面に残す（トーストだと見逃して「反映されていない」と感じやすいため）
  const [restoreResult, setRestoreResult] = useState<
    { ok: true; rep: RestoreReport; questionsInDb: number } | { ok: false; message: string } | null
  >(null)
  const [restoring, setRestoring] = useState(false)
  const [pendingNotes, setPendingNotes] = useState(0)

  useEffect(() => {
    // 問題が取り込まれていれば、保留中のメモをここでも反映しておく
    void applyPendingNotes().then(() => pendingNotesCount().then(setPendingNotes))
  }, [])

  async function onBackup() {
    try {
      const json = await exportBackupJson(includeQuestions)
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backupFilename()
      a.click()
      URL.revokeObjectURL(url)
      toast('学習データをバックアップしました')
    } catch (e) {
      toast('バックアップに失敗しました')
      console.error(e)
    }
  }

  /**
   * ファイルをテキストとして読む。
   * iOS Safari では file.text() が使えない／input を空にした後に読めなくなることがあるため、
   * 入力欄をクリアする前に読み、FileReader へフォールバックする。
   */
  function readFileText(file: File): Promise<string> {
    if (typeof file.text === 'function') {
      return file.text().catch(() => readWithFileReader(file))
    }
    return readWithFileReader(file)
  }

  function readWithFileReader(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result ?? ''))
      fr.onerror = () => reject(fr.error ?? new Error('ファイルを読み取れませんでした'))
      fr.readAsText(file, 'utf-8')
    })
  }

  async function onRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    if (
      !confirm(
        '現在の学習履歴（SRS・連続日数・模試結果・誤答ログ）を、選んだバックアップの内容で置き換えます。よろしいですか？',
      )
    ) {
      input.value = ''
      return
    }
    setRestoring(true)
    setRestoreResult(null)
    try {
      // 入力欄をクリアする前に読み切る（クリア後はファイルを読めない端末がある）
      const text = await readFileText(file)
      if (!text.trim()) throw new Error('ファイルが空でした。別のファイルを選んでください。')
      const rep = await restoreBackup(text)
      const questionsInDb = await db.questions.count()
      setPendingNotes(await pendingNotesCount())
      setRestoreResult({ ok: true, rep, questionsInDb })
      toast('学習データを復元しました')
    } catch (err) {
      const message = (err as Error).message || '復元に失敗しました'
      setRestoreResult({ ok: false, message })
      toast('復元に失敗しました')
      console.error(err)
    } finally {
      input.value = ''
      setRestoring(false)
    }
  }

  async function resetProgress() {
    if (!confirm('学習履歴（SRS・活動・模試結果・誤答ログ）をすべて削除します。よろしいですか？')) return
    await db.transaction(
      'rw',
      db.studyRecords,
      db.activity,
      db.examResults,
      db.wrongLog,
      async () => {
        await db.studyRecords.clear()
        await db.activity.clear()
        await db.examResults.clear()
        await db.wrongLog.clear()
      },
    )
    setRestoreResult(null)
    toast('学習履歴をリセットしました')
  }

  return (
    <div className="card">
      <h2>学習データのバックアップ／復元</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        学習履歴・連続日数・模試結果・誤答ログ・設定・メモをまとめて書き出し／読み込みできます。
        既定では取り込んだ問題も同梱するので、機種変更のときはこのファイル1つで元どおりになります。
      </p>
      <div className="switch" style={{ marginBottom: 12 }}>
        <span>
          問題データも含める
          <small className="muted" style={{ display: 'block', fontSize: 11.5, lineHeight: 1.6 }}>
            オフにするとファイルは小さくなりますが、復元後に問題の取込が必要です
          </small>
        </span>
        <button
          className={`toggle ${includeQuestions ? 'on' : ''}`}
          aria-pressed={includeQuestions}
          onClick={() => void updateSettings({ backupIncludeQuestions: !includeQuestions })}
        />
      </div>
      <div className="review-actions" style={{ marginBottom: 12 }}>
        <button className="btn primary sm" onClick={onBackup}>
          学習データをバックアップ
        </button>
        <button className="btn sm" disabled={restoring} onClick={() => restoreRef.current?.click()}>
          {restoring ? '復元中…' : 'バックアップから復元'}
        </button>
      </div>
      <input
        ref={restoreRef}
        type="file"
        /* iOSのファイルアプリで選べないことがあるため拡張子とMIMEを広めに許可する */
        accept=".json,application/json,text/json,text/plain"
        onChange={onRestoreFile}
        style={{ display: 'none' }}
      />

      {restoreResult && (
        <div className={`restore-result${restoreResult.ok ? '' : ' ng'}`}>
          {restoreResult.ok ? (
            <>
              <div className="rr-title">復元しました</div>
              <ul className="rr-list">
                <li>学習記録（SRS） {restoreResult.rep.studyRecords} 件</li>
                <li>学習した日 {restoreResult.rep.activity} 日ぶん</li>
                <li>本番シミュレーション {restoreResult.rep.examResults} 件</li>
                <li>誤答ログ {restoreResult.rep.wrongLog} 件</li>
                <li>問題データ {restoreResult.rep.questions} 問</li>
                <li>メモ・補足解説 {restoreResult.rep.notesApplied} 件</li>
              </ul>
              {restoreResult.rep.notesPending > 0 && (
                <p className="rr-note">
                  メモ {restoreResult.rep.notesPending} 件は対象の問題がまだ取り込まれていないため保留中です。
                  上の「ファイルを選択」から問題を取り込むと<b>自動で反映</b>されます（復元をやり直す必要はありません）。
                </p>
              )}
              {restoreResult.questionsInDb === 0 && (
                <p className="rr-note">
                  問題データが1問もありません。上の「ファイルを選択」から公式過去問を取り込むと、
                  復元した学習履歴がカテゴリ別の成績などに反映されます。
                </p>
              )}
            </>
          ) : (
            <>
              <div className="rr-title">復元できませんでした</div>
              <p className="rr-note">{restoreResult.message}</p>
              <p className="rr-note">
                StudyDrillで書き出した <code>studydrill-backup-….json</code> を選んでください。
                iPhoneでファイルが選べないときは、一度「ファイル」アプリに保存してから選ぶと開けます。
              </p>
            </>
          )}
        </div>
      )}

      {!restoreResult && pendingNotes > 0 && (
        <div className="restore-result">
          <div className="rr-title">保留中のメモがあります</div>
          <p className="rr-note">
            復元済みのメモ {pendingNotes} 件が、対象の問題の取込待ちです。
            問題を取り込むと自動で反映されます。
          </p>
        </div>
      )}

      <hr className="sep" />
      <button className="btn ghost" style={{ color: 'var(--wrong)' }} onClick={resetProgress}>
        学習履歴をリセット
      </button>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        ※ リセットは学習履歴（SRS・連続日数・模試結果・誤答ログ）だけを削除します。
        取り込んだ問題とメモは残ります。
      </p>
    </div>
  )
}
