import type { ReactElement } from 'react'

// AIサービスのブランドマーク（添付アイコンを模したインラインSVG）。
// 各AIのブランド色を「背景」に敷くチップ上で使うため、マーク自体は currentColor で
// 塗り、親（チップ）の文字色（白 or 黒）を継承させて視認性を確保する。
export type BrandName = 'claude' | 'chatgpt'

// Claude（Anthropic）：オレンジの放射バースト。中心から等間隔にスポークを描く。
function ClaudeMark(): ReactElement {
  const cx = 12
  const cy = 12
  const inner = 2.6
  const outer = 10.5
  const spokes = 12
  const lines = Array.from({ length: spokes }, (_, i) => {
    const a = (i * (360 / spokes) * Math.PI) / 180
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    return (
      <line
        key={i}
        x1={cx + inner * dx}
        y1={cy + inner * dy}
        x2={cx + outer * dx}
        y2={cy + outer * dy}
      />
    )
  })
  return (
    <g stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      {lines}
    </g>
  )
}

// ChatGPT（OpenAI）：花結び（ヘキサフォイル）マーク。24x24 の viewBox に収まるよう
// 公式ロゴを等倍で描いた単一パス。fillRule/clipRule を明示して塗りの内外判定を安定させる。
function ChatgptMark(): ReactElement {
  return (
    <path
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M20.562 10.188a4.94 4.94 0 0 0-.425-4.055 4.996 4.996 0 0 0-5.38-2.396 4.94 4.94 0 0 0-3.728-1.66 4.997 4.997 0 0 0-4.766 3.462 4.942 4.942 0 0 0-3.302 2.395 4.997 4.997 0 0 0 .615 5.857 4.94 4.94 0 0 0 .424 4.056 4.996 4.996 0 0 0 5.38 2.395 4.94 4.94 0 0 0 3.728 1.66 4.997 4.997 0 0 0 4.769-3.464 4.94 4.94 0 0 0 3.301-2.396 4.998 4.998 0 0 0-.616-5.854zm-7.464 10.427a3.71 3.71 0 0 1-2.382-.862l.118-.067 3.953-2.283a.643.643 0 0 0 .325-.562v-5.574l1.671.966a.06.06 0 0 1 .033.046v4.616a3.726 3.726 0 0 1-3.721 3.72zm-8.005-3.42a3.71 3.71 0 0 1-.444-2.494l.118.07 3.953 2.283a.641.641 0 0 0 .649 0l4.827-2.786v1.932a.06.06 0 0 1-.024.05l-3.996 2.307a3.725 3.725 0 0 1-5.083-1.362zm-1.04-8.627a3.71 3.71 0 0 1 1.939-1.633v4.7a.643.643 0 0 0 .325.562l4.827 2.786-1.671.965a.06.06 0 0 1-.057.005l-3.996-2.31a3.725 3.725 0 0 1-1.366-5.075zm13.729 3.195-4.828-2.786 1.671-.965a.06.06 0 0 1 .057-.005l3.996 2.308a3.72 3.72 0 0 1-.574 6.712v-4.702a.643.643 0 0 0-.322-.562zm1.663-2.505-.118-.07-3.952-2.286a.643.643 0 0 0-.65 0l-4.826 2.786V7.526a.06.06 0 0 1 .024-.05l3.996-2.305a3.723 3.723 0 0 1 5.527 3.858zm-10.46 3.44-1.672-.966a.06.06 0 0 1-.033-.046V10.51a3.724 3.724 0 0 1 6.103-2.858l-.118.067-3.953 2.283a.643.643 0 0 0-.325.562zm.909-1.955 2.15-1.24 2.15 1.24v2.48l-2.15 1.24-2.15-1.24z"
    />
  )
}

const MARKS: Record<BrandName, () => ReactElement> = {
  claude: ClaudeMark,
  chatgpt: ChatgptMark,
}

// マークは currentColor 塗り。色はチップ側（.ai-chip.brand-*）の文字色で決まる。
export function BrandIcon({ name, size = 16 }: { name: BrandName; size?: number }) {
  const Mark = MARKS[name]
  return (
    <span
      className={`brand-icon brand-${name}`}
      style={{ width: size, height: size, display: 'inline-flex' }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Mark />
      </svg>
    </span>
  )
}
