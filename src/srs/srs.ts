import type { Box, StudyRecord, Question } from '../types'
import { startOfLocalDay } from '../lib/dateutil'

const DAY = 24 * 60 * 60 * 1000

/** Leitner箱ごとの再出題間隔（ms）。box1=即日, 2=1日, 3=3日, 4=7日, 5=14日 */
export const BOX_INTERVALS: Record<Box, number> = {
  1: 0,
  2: 1 * DAY,
  3: 3 * DAY,
  4: 7 * DAY,
  5: 14 * DAY,
}

/**
 * 誤答の再学習ステップ（ms）。誤答を dueAt=now にすると学習を開き直した直後に
 * 同じ問題が先頭へ即再登場し「回答が反映されていない」ように見えるため、
 * 少し先送りして直後の再出題を防ぐ（同日中の復習は維持）。
 */
export const RELEARN_STEP = 10 * 60 * 1000 // 10分

export function newRecord(questionId: string, now: number): StudyRecord {
  return {
    questionId,
    box: 1,
    dueAt: now,
    lastAnswered: 0,
    correctCount: 0,
    wrongCount: 0,
  }
}

/** 回答結果を Leitner 方式で反映した新レコードを返す（純関数） */
export function applyAnswer(
  rec: StudyRecord,
  correct: boolean,
  now: number,
  chosen?: number,
): StudyRecord {
  if (correct) {
    const box = Math.min(5, rec.box + 1) as Box
    return {
      ...rec,
      box,
      dueAt: now + BOX_INTERVALS[box],
      lastAnswered: now,
      correctCount: rec.correctCount + 1,
      lastWrongChoice: undefined,
    }
  }
  return {
    ...rec,
    box: 1,
    dueAt: now + RELEARN_STEP, // 少し先送り（直後の即再登場を防止・同日中に復習）
    lastAnswered: now,
    wrongCount: rec.wrongCount + 1,
    lastWrongChoice: chosen as StudyRecord['lastWrongChoice'],
  }
}

export interface QueueOptions {
  now: number
  /** カテゴリ絞り込み（未指定 = 全カテゴリ横断＝インターリービング） */
  categories?: string[]
  /** box1・2のみ（間違いだけモード） */
  wrongOnly?: boolean
  /** 最大件数 */
  limit?: number
  /** 出題を特定の問題IDに限定（試験結果からの復習など） */
  questionIds?: string[]
}

/**
 * 出題キューを構築する（メイン学習）。
 * 方針（今日の学習の重複防止・全ジャンル満遍なく）:
 * 1. その日に既に解いた問題は出さない（中断→再開でも同じ問題が出ない）。
 * 2. 未出題（未学習）を全7ジャンル満遍なく（インターリービング）出すのを最優先。
 * 3. 未出題が尽きたら、前日以前に学習して復習期限が来たものをジャンル均等で補完。
 * ※ 間違い復習は別ボタン（wrongOnly）で行う。
 */
export function buildQueue(
  questions: Question[],
  records: Map<string, StudyRecord>,
  opts: QueueOptions,
): Question[] {
  const { now, categories, wrongOnly, limit, questionIds } = opts

  let pool = questions
  if (questionIds && questionIds.length > 0) {
    const ids = new Set(questionIds)
    pool = pool.filter((q) => ids.has(q.id))
  }
  if (categories && categories.length > 0) {
    const set = new Set(categories)
    pool = pool.filter((q) => set.has(q.category))
  }

  const withRec = pool.map((q) => ({ q, rec: records.get(q.id) }))

  if (wrongOnly) {
    // 間違い復習（別ボタン）: box1・2 を集中反復。ここは当日除外しない。
    const due = withRec
      .filter((x) => x.rec && (x.rec.box === 1 || x.rec.box === 2))
      .sort(cmpDue(now))
      .map((x) => x.q)
    return limit ? due.slice(0, limit) : due
  }

  // 出題を特定IDに限定（試験結果からの復習など）はそのIDを出題順で（当日除外しない）。
  if (questionIds && questionIds.length > 0) {
    return limit ? pool.slice(0, limit) : pool
  }

  // その日に解いた問題は除外（中断→再開で同じ問題を出さない）。
  const todayStart = startOfLocalDay(now)
  const answeredToday = (rec?: StudyRecord) => !!rec && rec.lastAnswered >= todayStart
  const notToday = withRec.filter((x) => !answeredToday(x.rec))
  const priority = categoryPriority(withRec)

  // 1) 未出題（未学習）を全ジャンル満遍なく。最優先。
  const unseen = balanceByCategory(
    notToday.filter((x) => !x.rec || x.rec.lastAnswered === 0).map((x) => x.q),
    priority,
  )

  // 2) 前日以前に学習し復習期限が来たものをジャンル均等で補完（未出題が尽きたとき）。
  const dueReview = balanceByCategory(
    notToday.filter((x) => x.rec && x.rec.lastAnswered > 0 && x.rec.dueAt <= now).map((x) => x.q),
    priority,
  )

  const queue = [...unseen, ...dueReview]
  return limit ? queue.slice(0, limit) : queue
}

/**
 * カテゴリごとの優先度（値が小さいほど先に出す）。
 * 正答率が低いほど・回答数が少ないほど優先（苦手＆手薄なカテゴリを前に）。
 */
function categoryPriority(withRec: { q: Question; rec?: StudyRecord }[]): Map<string, number> {
  const agg = new Map<string, { correct: number; wrong: number; answered: number }>()
  for (const { q, rec } of withRec) {
    const a = agg.get(q.category) ?? { correct: 0, wrong: 0, answered: 0 }
    if (rec && rec.lastAnswered > 0) {
      a.correct += rec.correctCount
      a.wrong += rec.wrongCount
      a.answered += 1
    }
    agg.set(q.category, a)
  }
  const pr = new Map<string, number>()
  for (const [cat, a] of agg) {
    const denom = a.correct + a.wrong
    const acc = denom > 0 ? a.correct / denom : 0
    // 正答率を主・回答数を従（どちらも小さいほど優先＝先頭）
    pr.set(cat, acc * 100000 + a.answered)
  }
  return pr
}

/**
 * カテゴリ横断のインターリービング。優先度の高い（値が小さい）カテゴリから
 * 1問ずつ回して取り出し、特定カテゴリに偏らないよう均等に混ぜる。
 */
function balanceByCategory(items: Question[], priority: Map<string, number>): Question[] {
  const groups = new Map<string, Question[]>()
  for (const q of shuffle(items)) {
    const g = groups.get(q.category) ?? []
    g.push(q)
    groups.set(q.category, g)
  }
  const cats = [...groups.keys()].sort(
    (a, b) => (priority.get(a) ?? 0) - (priority.get(b) ?? 0),
  )
  const out: Question[] = []
  let added = true
  while (added) {
    added = false
    for (const c of cats) {
      const g = groups.get(c)
      if (g && g.length) {
        out.push(g.shift()!)
        added = true
      }
    }
  }
  return out
}

function cmpDue(_now: number) {
  return (
    a: { rec?: StudyRecord },
    b: { rec?: StudyRecord },
  ): number => {
    const ra = a.rec!
    const rb = b.rec!
    if (ra.box !== rb.box) return ra.box - rb.box // box 小さい順
    return ra.dueAt - rb.dueAt // dueAt 古い順
  }
}

/** Fisher–Yates（この関数の呼び出し側で決定性は不要。React外の純計算） */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
