// ホーム以外のページ（成績・取込・設定・受験履歴）のヘッダーに置く「戻る」ボタン。
// 添付アイコン（Uターンの戻る矢印）を白で描き、周りをプライマリ色のボタンにする。
export function BackHome({
  onClick,
  label = 'ホームに戻る',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button className="backhome" onClick={onClick} aria-label={label}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {/* 上のバー → 右のUターン → 下の戻り線 */}
        <path
          d="M5 6 H13 a5.2 5.2 0 0 1 0 10.4 H8"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* 左向きの大きな矢じり */}
        <path d="M8.5 10.8 L2.6 16.4 L8.5 22 Z" fill="currentColor" />
      </svg>
    </button>
  )
}
