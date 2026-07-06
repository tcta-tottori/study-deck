import { useEffect, useState } from 'react'
import { getSettings, updateSettings, db } from '../db/db'
import type { AppSettings } from '../types'
import { notificationPermission, requestNotificationPermission } from '../lib/reminder'
import { useToast } from '../components/Toast'

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

  return (
    <>
      <header className="appbar">
        <button className="iconbtn" onClick={onBack} aria-label="戻る">
          ←
        </button>
        <h1>設定</h1>
      </header>
      <div className="screen">
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
          <button className="btn ghost" style={{ color: 'var(--wrong)' }} onClick={resetProgress}>
            学習履歴をリセット
          </button>
        </div>

        <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>
          StudyDrill · 生産管理プランニング3級 学習アプリ · 端末内で完結・オフライン対応
        </p>
        <p className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>
          最終更新: {formatBuildTime()}
        </p>
      </div>
    </>
  )
}
