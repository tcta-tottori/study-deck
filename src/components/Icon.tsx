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
  | 'speaker'
  | 'play'
  | 'pause'
  | 'prev'
  | 'next'
  | 'expand'
  | 'close'
  | 'printer'
  | 'navHome'
  | 'navVoice'
  | 'navNote'
  | 'navStats'
  | 'navImport'
  | 'navSettings'

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
  // 縦横切替（端末回転アイコン：傾けた縦長スマホ＋回転を示す2本の矢印）
  swap: (
    <>
      {/* 端末（縦長スマホ）。塗りは半透明で本体を表現し、輪郭を描く */}
      <rect
        x="7.25"
        y="5"
        width="9.5"
        height="14"
        rx="2.3"
        transform="rotate(-40 12 12)"
        fill="currentColor"
        fillOpacity={0.2}
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      {/* 回転を示す2本の矢印（右上・左下） */}
      <path
        fill="currentColor"
        stroke="none"
        d="M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32z"
      />
      <path
        fill="currentColor"
        stroke="none"
        d="M7.52 21.48C4.25 19.94 1.91 16.76 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z"
      />
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
  // スピーカー（音声解説）
  speaker: (
    <>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18 6.6a7.5 7.5 0 0 1 0 10.8" />
    </>
  ),
  // 再生
  play: <path d="M7 4.8 19 12 7 19.2z" strokeLinejoin="round" />,
  // 一時停止
  pause: (
    <>
      <rect x="6.5" y="4.5" width="4" height="15" rx="1.2" />
      <rect x="13.5" y="4.5" width="4" height="15" rx="1.2" />
    </>
  ),
  // 前へ（セクション戻り）
  prev: (
    <>
      <path d="M18 5.5 9.5 12 18 18.5z" strokeLinejoin="round" />
      <line x1="6" y1="5.5" x2="6" y2="18.5" />
    </>
  ),
  // 次へ（セクション送り）
  next: (
    <>
      <path d="M6 5.5 14.5 12 6 18.5z" strokeLinejoin="round" />
      <line x1="18" y1="5.5" x2="18" y2="18.5" />
    </>
  ),
  // 全画面表示（四隅の矢印）
  expand: (
    <>
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    </>
  ),
  // 閉じる（×）
  close: <path d="M6 6l12 12M18 6 6 18" />,
  // プリンター
  printer: (
    <>
      <path d="M7 9V4.5A.5.5 0 0 1 7.5 4h9a.5.5 0 0 1 .5.5V9" />
      <path d="M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-5A1.5 1.5 0 0 1 5.5 9h13a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17" />
      <rect x="7" y="14" width="10" height="6" rx="1" />
    </>
  ),
  // ---- メニュー（ナビ）用デュオトーンアイコン：輪郭＋淡い塗りで面を表現 ----
  navHome: (
    <>
      <path fill="currentColor" fillOpacity={0.18} stroke="none" d="M5.5 9.4 12 3.9l6.5 5.5v9.1a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M3.5 10.8 11.2 4.3a1.2 1.2 0 0 1 1.6 0l7.7 6.5" />
      <path d="M5.5 9.4v9.1A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5V9.4" />
      <path d="M10 20v-4a2 2 0 0 1 4 0v4" />
    </>
  ),
  navVoice: (
    <>
      <path
        fill="currentColor" fillOpacity={0.18}
        d="M4.5 9.3h2.8l4.1-3.4a.7.7 0 0 1 1.1.5v11.2a.7.7 0 0 1-1.1.5l-4.1-3.4H4.5a1 1 0 0 1-1-1v-3.4a1 1 0 0 1 1-1z"
      />
      <path d="M16 9.3a3.8 3.8 0 0 1 0 5.4" />
      <path d="M18.6 6.8a7.4 7.4 0 0 1 0 10.4" />
    </>
  ),
  navNote: (
    <>
      <path fill="currentColor" fillOpacity={0.18} d="M6 3.5h9.2L19 7.3v11.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
      <path d="M15 3.6V6.5a1 1 0 0 0 1 1h2.9" />
      <path d="M8 11h7.5M8 14.5h7.5M8 18h4.5" />
    </>
  ),
  navStats: (
    <>
      <rect fill="currentColor" fillOpacity={0.18} x="4" y="12.5" width="4" height="7.5" rx="1.2" />
      <rect fill="currentColor" fillOpacity={0.18} x="10" y="5" width="4" height="15" rx="1.2" />
      <rect fill="currentColor" fillOpacity={0.18} x="16" y="9" width="4" height="11" rx="1.2" />
    </>
  ),
  navImport: (
    <>
      <path fill="currentColor" fillOpacity={0.18} d="M3.5 14h4.4l1.4 2.5h5.4l1.4-2.5h4.4v4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M12 3.5v8.5" />
      <path d="M8.5 8.8 12 12.3l3.5-3.5" />
    </>
  ),
  navSettings: (
    <>
      <path
        fill="currentColor" fillOpacity={0.18}
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
}

export function Icon({
  name,
  size = 24,
  strokeWidth = 1.8,
  linecap = 'round',
  linejoin = 'round',
  className,
}: {
  name: IconName
  size?: number
  strokeWidth?: number
  linecap?: 'round' | 'butt' | 'square'
  linejoin?: 'round' | 'miter' | 'bevel'
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
      strokeLinecap={linecap}
      strokeLinejoin={linejoin}
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
