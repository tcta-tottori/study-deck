import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../db/db'
import type { AppSettings } from '../types'
import { SUBJECTS, getSubject } from '../lib/subjects'
import { notificationPermission, requestNotificationPermission } from '../lib/reminder'
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

export default function Settings({
  onBack,
  onGoImport,
}: {
  onBack: () => void
  /** 取込ページ（バックアップ／復元の置き場所）へ移動する */
  onGoImport: () => void
}) {
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
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            学習データのバックアップ・復元・学習履歴のリセットは、問題の取込と同じ
            「取込」ページにまとめました。
          </p>
          <button className="btn primary sm" onClick={onGoImport}>
            取込ページを開く
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
