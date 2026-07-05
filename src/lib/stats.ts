import { CATEGORIES, type Category, type Question, type StudyRecord } from '../types'

export interface CategoryStat {
  category: Category
  total: number // 問題数
  answered: number
  correct: number
  wrong: number
  accuracy: number // 0..1（正答/(正答+誤答)）。未回答は分母に含めない
}

export function categoryStats(
  questions: Question[],
  records: Map<string, StudyRecord>,
): CategoryStat[] {
  const byCat = new Map<Category, CategoryStat>()
  for (const c of CATEGORIES) {
    byCat.set(c, { category: c, total: 0, answered: 0, correct: 0, wrong: 0, accuracy: 0 })
  }
  for (const q of questions) {
    const s = byCat.get(q.category)
    if (!s) continue
    s.total++
    const r = records.get(q.id)
    if (r && r.lastAnswered > 0) {
      s.answered++
      s.correct += r.correctCount
      s.wrong += r.wrongCount
    }
  }
  for (const s of byCat.values()) {
    const denom = s.correct + s.wrong
    s.accuracy = denom > 0 ? s.correct / denom : 0
  }
  return CATEGORIES.map((c) => byCat.get(c)!).filter((s) => s.total > 0)
}

export function boxDistribution(
  questions: Question[],
  records: Map<string, StudyRecord>,
): number[] {
  const dist = [0, 0, 0, 0, 0, 0] // index0 = 未学習, 1..5 = box
  for (const q of questions) {
    const r = records.get(q.id)
    if (!r || r.lastAnswered === 0) dist[0]++
    else dist[r.box]++
  }
  return dist
}

export function dueCount(records: Map<string, StudyRecord>, now: number): number {
  let n = 0
  for (const r of records.values()) if (r.dueAt <= now) n++
  return n
}

/** 全体の正答率（回答済のみ） */
export function overallAccuracy(records: Map<string, StudyRecord>): number {
  let c = 0
  let w = 0
  for (const r of records.values()) {
    c += r.correctCount
    w += r.wrongCount
  }
  return c + w > 0 ? c / (c + w) : 0
}

/** 合格ライン(60%)到達の簡易判定メッセージ */
export function passOutlook(acc: number): { pct: number; label: string; ok: boolean } {
  const pct = Math.round(acc * 100)
  if (acc >= 0.75) return { pct, label: '合格圏内。安定して正解できています。', ok: true }
  if (acc >= 0.6) return { pct, label: '合格ラインは超過。取りこぼしを減らしましょう。', ok: true }
  if (acc >= 0.45) return { pct, label: 'あと一歩。苦手カテゴリを重点反復。', ok: false }
  return { pct, label: '基礎固めの段階。まずは毎日20問を継続。', ok: false }
}
