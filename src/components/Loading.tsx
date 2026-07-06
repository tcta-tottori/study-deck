// 起動時などの読み込み画面（ブランドのSTUDYロゴ＋スピナー）
export default function Loading() {
  const base = import.meta.env.BASE_URL
  return (
    <div className="loading">
      <img className="loading-logo" src={`${base}pwa-192.png`} alt="" width={88} height={88} />
      <div className="spinner" aria-hidden="true" />
      <div className="loading-text">読み込み中…</div>
    </div>
  )
}
