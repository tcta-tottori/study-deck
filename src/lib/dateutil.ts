/** ローカルタイムの 'YYYY-MM-DD' */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d + delta)
  return dayKey(dt.getTime())
}

/** activity の day 集合から、today を起点にした連続学習日数を求める */
export function computeStreak(days: Set<string>, todayKey: string): number {
  let streak = 0
  let cursor = todayKey
  // 今日がまだ0でも、昨日までの連続を切らさないため、今日が無ければ昨日から数える
  if (!days.has(cursor)) {
    cursor = addDaysKey(cursor, -1)
    if (!days.has(cursor)) return 0
  }
  while (days.has(cursor)) {
    streak++
    cursor = addDaysKey(cursor, -1)
  }
  return streak
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
