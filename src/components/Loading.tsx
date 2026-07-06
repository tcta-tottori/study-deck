// データ読込中の画面（3Dの本ページめくりアニメ＋点滅する「読み込み中」）
export default function Loading() {
  return (
    <div className="loading">
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
