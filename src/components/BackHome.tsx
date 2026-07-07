import { Icon } from './Icon'

// ホーム以外のページ（成績・取込・設定）のヘッダーに置く「ホームへ戻る」ボタン。
// プライマリ色でほんのり色づけしたピル＋ホームアイコンで、素っ気ない「←」より少しおしゃれに。
export function BackHome({ onClick }: { onClick: () => void }) {
  return (
    <button className="backhome" onClick={onClick} aria-label="ホームに戻る">
      <Icon name="home" size={16} strokeWidth={2} />
      <span>ホーム</span>
    </button>
  )
}
