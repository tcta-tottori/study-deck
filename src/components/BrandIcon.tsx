import type { ReactElement } from 'react'

// AIサービスのブランドマーク（添付アイコンを模したインラインSVG）。
// currentColor ではなく各ブランド固有色で塗るため、チップ上でも識別しやすい。
export type BrandName = 'claude' | 'gemini' | 'chatgpt'

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
    <g stroke="#D97757" strokeWidth={2.2} strokeLinecap="round">
      {lines}
    </g>
  )
}

// Gemini：4方向にとがったスパーク（凹んだ四芒星）を青→紫→赤のグラデーションで。
function GeminiMark(): ReactElement {
  return (
    <>
      <defs>
        <linearGradient id="brand-gemini" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9168C0" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        fill="url(#brand-gemini)"
        d="M12 2c.3 4.6 1.9 8 8 10-6.1 2-7.7 5.4-8 10-.3-4.6-1.9-8-8-10 6.1-2 7.7-5.4 8-10z"
      />
    </>
  )
}

// ChatGPT（OpenAI）：花結び（ヘキサフォイル）マーク。単一パスで塗りつぶす。
function ChatgptMark(): ReactElement {
  return (
    <path
      fill="#000"
      d="M22.28 9.82a5.99 5.99 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.99 5.99 0 0 0-3.99 2.9 6.05 6.05 0 0 0 .74 7.1 5.99 5.99 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 22a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 3.99-2.9 6.06 6.06 0 0 0-.74-7.07zM13.26 20.6a4.5 4.5 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.78.78 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.5 4.5zM3.6 16.47a4.47 4.47 0 0 1-.54-3.01l.14.08 4.78 2.76a.78.78 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.73 20.1a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.49 4.49 0 0 1 2.35-1.97V11.6a.78.78 0 0 0 .39.68l5.84 3.37-2.02 1.17a.08.08 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.86-5.84-3.37 2.02-1.17a.08.08 0 0 1 .07 0l4.83 2.79a4.5 4.5 0 0 1-.68 8.12v-5.68a.78.78 0 0 0-.4-.69zm2.01-3.02-.14-.08-4.78-2.76a.78.78 0 0 0-.78 0L9.4 9.28V6.95a.08.08 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.3 12.86l-2.02-1.17a.07.07 0 0 1-.04-.05V6.06a4.5 4.5 0 0 1 7.38-3.46l-.14.08L8.7 5.44a.78.78 0 0 0-.39.68zm1.1-2.37 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z"
    />
  )
}

const MARKS: Record<BrandName, () => ReactElement> = {
  claude: ClaudeMark,
  gemini: GeminiMark,
  chatgpt: ChatgptMark,
}

// ダークテーマではChatGPTの黒マークが埋もれるため、白背景の丸を敷いて視認性を確保。
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
