// データ読込中の画面（起動ローダーと同じ「本のページめくり」アニメーション）
export default function Loading() {
  const base = import.meta.env.BASE_URL
  return (
    <div className="loading">
      <img className="loading-logo" src={`${base}pwa-192.png`} alt="" width={84} height={84} />
      <div className="bookflip" aria-hidden="true">
        <div className="bk">
          <span className="h l" />
          <span className="h r" />
          <span className="pg" />
          <span className="pg" />
          <span className="pg" />
        </div>
      </div>
      <div className="loading-text">読み込み中…</div>
    </div>
  )
}
