import type { ReactElement } from 'react'

// 統一ラインアイコン（24グリッド・stroke=currentColor）。
// 色は currentColor で親から継承 → 配色に統一感を持たせる。
export type IconName =
  | 'home'
  | 'bolt'
  | 'chart'
  | 'import'
  | 'gear'
  | 'book'
  | 'timer'
  | 'refresh'
  | 'clipboard'
  | 'flame'
  | 'arrow'
  | 'pencil'
  | 'calendar'
  | 'sparkle'
  | 'copy'
  | 'phone'
  | 'monitor'
  | 'menu'
  | 'chevron'
  | 'check'
  | 'swap'
  | 'sun'
  | 'moon'

const PATHS: Record<IconName, ReactElement> = {
  home: (
    <>
      <path d="M4 11.4 11.3 4.6a1 1 0 0 1 1.4 0L20 11.4" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  bolt: <path d="M13 2 5 13h5l-1 9 9-12h-5z" />,
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-5" />
      <path d="M12 20v-10" />
      <path d="M17 20v-7" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v10" />
      <path d="M8 9.5 12 13.5 16 9.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  book: (
    <>
      <path d="M6.5 4H16a1.5 1.5 0 0 1 1.5 1.5V20H8a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M9.5 4v14.5" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5" />
      <path d="M9.5 3h5" />
      <path d="M12 3v2.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4.5V8h-3.5" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4H7a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2" />
      <path d="M9 3.4h6V6H9z" />
      <path d="M9 13l2 2 4-4" />
    </>
  ),
  flame: (
    <path d="M12 3c2.7 3.1 4.2 5.2 4.2 8A4.2 4.2 0 0 1 7.8 11c0-1.1.4-2 1.1-2.8.1 1 .7 1.5 1.4 1.5.9 0 1.7-1.4 1.7-6.7z" />
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  pencil: (
    <>
      <path d="M4 20h4L18.5 9.5a1.9 1.9 0 0 0 0-2.7l-1.3-1.3a1.9 1.9 0 0 0-2.7 0L4 16z" />
      <path d="M13.5 7 17 10.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v3.5M16 3v3.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>
  ),
  // スマホ（縦画面）アイコン
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <line x1="10.5" y1="18.5" x2="13.5" y2="18.5" />
    </>
  ),
  // モニター/PC（横画面）アイコン
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <line x1="8.5" y1="20" x2="15.5" y2="20" />
      <line x1="12" y1="16" x2="12" y2="20" />
    </>
  ),
  // ハンバーガー（メニュー）
  menu: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </>
  ),
  // 下向きシェブロン（プルダウン表示用）
  chevron: <path d="M6 9l6 6 6-6" />,
  // チェック
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  // 縦横切替（対角に並ぶ、向きが逆の2本の矢印）
  swap: (
    <>
      {/* ↘ 下向きの矢印 */}
      <path d="M8 3 L18 13" />
      <path d="M18 9 L18 13 L14 13" />
      {/* ↖ 上向きの矢印 */}
      <path d="M16 21 L6 11" />
      <path d="M6 15 L6 11 L10 11" />
    </>
  ),
  // 太陽（ライトモード）
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
    </>
  ),
  // 月（ダークモード）
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
}

export function Icon({
  name,
  size = 24,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
