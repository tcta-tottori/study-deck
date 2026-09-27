import { useEffect, useRef, useState } from 'react'
import { getSettings, updateSettings, db, pendingNotesCount, applyPendingNotes } from '../db/db'
import type { AppSettings } from '../types'
import { SUBJECTS, getSubject } from '../lib/subjects'
import { notificationPermission, requestNotificationPermission } from '../lib/reminder'
import { exportBackupJson, backupFilename, restoreBackup, type RestoreReport } from '../lib/backup'
import { useToast } from '../components/Toast'
import { BackHome } from '../components/BackHome'

// ビルド時刻（デプロイされたバージョンの目安）を日本時間で表示
function formatBuildTime(): string {
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(__BUILD_TIME__))
  } catch {
    return '不明'
  }
}

export default function Settings({ onBack }: { onBack: () => void }) {
  const toast = useToast()
  const [s, setS] = useState<AppSettings | null>(null)
  const [perm, setPerm] = useState<string>('default')
  const restoreRef = useRef<HTMLInputElement>(null)
  // 復元の結果は画面に残す（トーストだと見逃して「反映されていない」と感じやすいため）
  const [restoreResult, setRestoreResult] = useState<
    { ok: true; rep: RestoreReport; questionsInDb: number } | { ok: false; message: string } | null
  >(null)
  const [restoring, setRestoring] = useState(false)
  const [pendingNotes, setPendingNotes] = useState(0)

  useEffect(() => {
    getSettings().then(setS)
    setPerm(notificationPermission())
    // 起動後に問題が取り込まれていれば、保留中のメモをここでも反映しておく
    void applyPendingNotes().then(() => pendingNotesCount().then(setPendingNotes))
  }, [])

  if (!s) return <div className="screen"><div className="empty">読み込み中…</div></div>

  async function patch(p: Partial<AppSettings>) {
    const next = { ...s!, ...p }
    setS(next)
    await updateSettings(p)
  }

  async function askPermission() {
    const r = await requestNotificationPermission()
    setPerm(r)
    if (r === 'granted') toast('通知を許可しました')
    else if (r === 'denied') toast('通知はブロックされています')
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
    toast('学習履歴をリセットしました')
  }

  async function onBackup() {
    try {
      const json = await exportBackupJson(s!.backupIncludeQuestions !== false)
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
      setS(await getSettings())
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

  return (
    <>
      <header className="appbar">
        <BackHome onClick={onBack} />
        <h1>設定</h1>
      </header>
      <div className="screen">
        <div className="card">
          <h2>科目</h2>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="lbl">学習する試験科目</span>
            <select
              value={getSubject(s.subjectId).id}
              onChange={(e) => patch({ subjectId: e.target.value })}
            >
              {SUBJECTS.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            ※ 他の科目は今後追加予定です。ホーム上部の科目名からも切り替えられます。
          </p>
        </div>

        <div className="card">
          <h2>学習</h2>
          <label className="field">
            <span className="lbl">1日の目標問題数</span>
            <input
              type="number"
              min={1}
              max={200}
              value={s.dailyGoal}
              onChange={(e) => patch({ dailyGoal: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
          <div className="switch" style={{ marginBottom: 8 }}>
            <span>インターリービング（分野横断で出題）</span>
            <button
              className={`toggle ${s.interleave ? 'on' : ''}`}
              aria-pressed={s.interleave}
              onClick={() => patch({ interleave: !s.interleave })}
            />
          </div>
        </div>

        <div className="card">
          <h2>試験</h2>
          <label className="field">
            <span className="lbl">試験日（ホームのカウントダウン）</span>
            <input
              type="date"
              value={s.examDate}
              onChange={(e) => patch({ examDate: e.target.value || s.examDate })}
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="lbl">本番シミュレーションの制限時間（分）</span>
            <input
              type="number"
              min={1}
              max={300}
              value={Math.round(s.examDurationSec / 60)}
              onChange={(e) => patch({ examDurationSec: Math.max(1, Number(e.target.value) || 1) * 60 })}
            />
          </label>
        </div>

        <div className="card">
          <h2>表示</h2>
          <label className="field">
            <span className="lbl">テーマ</span>
            <select value={s.theme} onChange={(e) => patch({ theme: e.target.value as AppSettings['theme'] })}>
              <option value="auto">自動（システムに追従）</option>
              <option value="light">ライト</option>
              <option value="dark">ダーク</option>
            </select>
          </label>
        </div>

        <div className="card">
          <h2>リマインド</h2>
          <label className="field">
            <span className="lbl">毎日の通知時刻</span>
            <input
              type="time"
              value={s.reminderTime ?? ''}
              onChange={(e) => patch({ reminderTime: e.target.value || undefined })}
            />
          </label>
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button className="btn ghost" onClick={askPermission}>
              通知を許可する
            </button>
          )}
          {perm === 'unsupported' && (
            <p className="muted">この環境は通知に未対応です。アプリ内バナーでお知らせします。</p>
          )}
          {perm === 'granted' && <p className="muted">通知は許可されています。</p>}
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            ※ iOSのPWA通知には制約があります。未対応時はアプリ起動中にバナー表示へフォールバックします。
          </p>
        </div>

        <div className="card">
          <h2>音声で復習</h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            端末に入っている音声合成で解説を読み上げます（通信・APIキー不要。追加費用もかかりません）。
            ホームの「音声で復習」から再生できます。
          </p>
          <label className="field">
            <span className="lbl">読み上げ速度（{(s.voiceRate ?? 1).toFixed(1)}倍）</span>
            <input
              type="range"
              min={0.7}
              max={1.6}
              step={0.1}
              value={s.voiceRate ?? 1}
              onChange={(e) => patch({ voiceRate: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="lbl">「苦手・頻出」で読み上げる問題数</span>
            <input
              type="number"
              min={1}
              max={20}
              value={s.voiceWeakCount ?? 5}
              onChange={(e) =>
                patch({ voiceWeakCount: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })
              }
            />
          </label>
          <div className="switch" style={{ marginBottom: 8 }}>
            <span>問題文も読み上げる</span>
            <button
              className={`toggle ${s.voiceIncludeStem !== false ? 'on' : ''}`}
              aria-pressed={s.voiceIncludeStem !== false}
              onClick={() => patch({ voiceIncludeStem: !(s.voiceIncludeStem !== false) })}
            />
          </div>
          <div className="switch" style={{ marginBottom: 0 }}>
            <span>画面を開いたら自動で再生する</span>
            <button
              className={`toggle ${s.voiceAutoPlay ? 'on' : ''}`}
              aria-pressed={!!s.voiceAutoPlay}
              onClick={() => patch({ voiceAutoPlay: !s.voiceAutoPlay })}
            />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            ※ 声の種類は「音声で復習」画面で選べます（端末にインストールされている音声から選択）。
            iPhoneは設定＞アクセシビリティ＞読み上げコンテンツ＞声、Androidは設定＞ユーザー補助＞テキスト読み上げ、
            から日本語の音声を追加すると、より自然に読み上げられます。
          </p>
        </div>

        <div className="card">
          <h2>AI解説（任意）</h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Anthropic APIキーを登録すると、解説がない問題で「AI」ボタンから解説を生成できます。
            キーは端末内にのみ保存され、リポジトリには含まれません。未設定ならボタンは非表示です。
          </p>
          <label className="field">
            <span className="lbl">Anthropic APIキー</span>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={s.anthropicApiKey ?? ''}
              onChange={(e) => patch({ anthropicApiKey: e.target.value || undefined })}
            />
          </label>
        </div>

        <div className="card">
          <h2>データ</h2>
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
              className={`toggle ${s.backupIncludeQuestions !== false ? 'on' : ''}`}
              aria-pressed={s.backupIncludeQuestions !== false}
              onClick={() => patch({ backupIncludeQuestions: !(s.backupIncludeQuestions !== false) })}
            />
          </div>
          <div className="review-actions" style={{ marginBottom: 12 }}>
            <button className="btn primary sm" onClick={onBackup}>
              学習データをバックアップ
            </button>
            <button
              className="btn sm"
              disabled={restoring}
              onClick={() => restoreRef.current?.click()}
            >
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
                      取込画面から問題を取り込むと<b>自動で反映</b>されます（復元をやり直す必要はありません）。
                    </p>
                  )}
                  {restoreResult.questionsInDb === 0 && (
                    <p className="rr-note">
                      問題データが1問もありません。取込画面から公式過去問を取り込むと、
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
                取込画面から問題を取り込むと自動で反映されます。
              </p>
            </div>
          )}
          <hr className="sep" />
          <button className="btn ghost" style={{ color: 'var(--wrong)' }} onClick={resetProgress}>
            学習履歴をリセット
          </button>
        </div>

        <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>
          StudyDrill · {getSubject(s.subjectId).name} 学習アプリ · 端末内で完結・オフライン対応
        </p>
        <p className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>
          最終更新: {formatBuildTime()}
        </p>
      </div>
    </>
  )
}
