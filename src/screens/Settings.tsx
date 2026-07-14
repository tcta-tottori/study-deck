import { useEffect, useRef, useState } from 'react'
import { getSettings, updateSettings, db } from '../db/db'
import type { AppSettings } from '../types'
import { SUBJECTS, getSubject } from '../lib/subjects'
import { notificationPermission, requestNotificationPermission } from '../lib/reminder'
import { exportBackupJson, backupFilename, restoreBackup } from '../lib/backup'
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

  useEffect(() => {
    getSettings().then(setS)
    setPerm(notificationPermission())
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
    if (!confirm('学習履歴（SRS・活動・模試結果）をすべて削除します。よろしいですか？')) return
    await db.transaction('rw', db.studyRecords, db.activity, db.examResults, async () => {
      await db.studyRecords.clear()
      await db.activity.clear()
      await db.examResults.clear()
    })
    toast('学習履歴をリセットしました')
  }

  async function onBackup() {
    try {
      const json = await exportBackupJson()
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

  async function onRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (restoreRef.current) restoreRef.current.value = ''
    if (!file) return
    if (
      !confirm(
        '現在の学習履歴（SRS・連続日数・模試結果）を、選んだバックアップの内容で置き換えます。よろしいですか？',
      )
    )
      return
    try {
      const rep = await restoreBackup(await file.text())
      setS(await getSettings())
      const pending = rep.notesPending > 0 ? `／メモ未適用 ${rep.notesPending}件（問題取込後に再復元で反映）` : ''
      toast(
        `復元しました：SRS ${rep.studyRecords}件・活動 ${rep.activity}日・模試 ${rep.examResults}件・メモ ${rep.notesApplied}件${pending}`,
      )
    } catch (err) {
      toast((err as Error).message || '復元に失敗しました')
      console.error(err)
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
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="lbl">解答後の解説の表示</span>
            <select
              value={s.answerMode ?? 'detailed'}
              onChange={(e) => patch({ answerMode: e.target.value as AppSettings['answerMode'] })}
            >
              <option value="detailed">詳細（全選択肢の理由を表示）</option>
              <option value="simple">シンプル（正解＋不正解の理由だけ）</option>
            </select>
          </label>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            ※ 学習中の解説シート右上の「詳細／シンプル」からも切り替えできます。
          </p>
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
            学習履歴・連続日数・模試結果・設定・メモをまとめて書き出し／読み込みできます。
            機種変更や端末データ消去に備えて保存してください（問題本文は含みません。公式過去問は
            取込データから別途取り込むと、IDが一致して履歴とメモが自動でひも付きます）。
          </p>
          <div className="review-actions" style={{ marginBottom: 12 }}>
            <button className="btn primary sm" onClick={onBackup}>
              学習データをバックアップ
            </button>
            <button className="btn sm" onClick={() => restoreRef.current?.click()}>
              バックアップから復元
            </button>
          </div>
          <input
            ref={restoreRef}
            type="file"
            accept=".json,application/json"
            onChange={onRestoreFile}
            style={{ display: 'none' }}
          />
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
