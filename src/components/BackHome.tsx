import { Icon } from './Icon'

// ホーム以外のページ（成績・取込・設定・受験履歴）のヘッダーに置く「ホームへ」ボタン。
// ホームアイコンを白で描き、周りをプライマリ色のボタンにする。
export function BackHome({
  onClick,
  label = 'ホームに戻る',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button className="backhome" onClick={onClick} aria-label={label}>
      <Icon name="home" size={22} strokeWidth={2} />
    </button>
  )
}
