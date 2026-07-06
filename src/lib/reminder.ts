import { dayKey } from './dateutil'

const SHOWN_KEY = 'reminder-shown-day'

/** 'HH:MM' → 今日のその時刻の epoch ms */
function todayAt(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.requestPermission()
}

/**
 * アプリ起動中に1日1回のリマインドをスケジュールする（best-effort）。
 * - 通知許可があればシステム通知、無ければ onFallback（アプリ内バナー）を呼ぶ。
 * - iOS PWA等の制約下ではフォールバックに寄せる。
 * 返り値: クリーンアップ関数。
 */
export function scheduleDailyReminder(
  hhmm: string | undefined,
  onFallback: () => void,
): () => void {
  if (!hhmm) return () => {}

  let timer: ReturnType<typeof setTimeout> | null = null

  const fire = () => {
    const today = dayKey(Date.now())
    if (localStorage.getItem(SHOWN_KEY) === today) return
    localStorage.setItem(SHOWN_KEY, today)
    const body = '今日の学習はお済みですか？1問だけでも回しましょう。'
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('StudyDrill 学習リマインド', { body })
      } catch {
        onFallback()
      }
    } else {
      onFallback()
    }
  }

  const schedule = () => {
    const now = Date.now()
    let target = todayAt(hhmm)
    const alreadyShown = localStorage.getItem(SHOWN_KEY) === dayKey(now)
    if (now >= target) {
      // 時刻を過ぎている
      if (!alreadyShown) {
        fire()
      }
      // 翌日へ
      target += 24 * 60 * 60 * 1000
    }
    const delay = Math.max(1000, target - now)
    timer = setTimeout(() => {
      fire()
      schedule()
    }, delay)
  }

  schedule()
  return () => {
    if (timer) clearTimeout(timer)
  }
}
