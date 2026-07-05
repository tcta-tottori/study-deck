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
