import type { Box, StudyRecord, Question } from '../types'

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
 * 出題キューを構築する。
 * 1. dueAt <= now を優先。その中で box 小さい順 → dueAt 古い順。
 * 2. キューが尽きたら未学習問題を投入。
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
    // box1・2、または未学習でも一度でも間違えたもの中心。ここでは box1・2 に限定。
    const due = withRec
      .filter((x) => x.rec && (x.rec.box === 1 || x.rec.box === 2))
      .sort(cmpDue(now))
      .map((x) => x.q)
    return limit ? due.slice(0, limit) : due
  }

  // 1) 復習期限が来たもの（間隔反復の核）。box 小さい＝直近で間違えた/苦手を優先。
  const dueNow = withRec
    .filter((x) => x.rec && x.rec.lastAnswered > 0 && x.rec.dueAt <= now)
    .sort(cmpDue(now))
    .map((x) => x.q)

  // 2) 未学習は、カテゴリを偏りなく（インターリービング）出しつつ、
  //    正答率が低い/回答数の少ないカテゴリを優先して導入する。
  const unseen = balanceByCategory(
    withRec.filter((x) => !x.rec || x.rec.lastAnswered === 0).map((x) => x.q),
    categoryPriority(withRec),
  )

  // 3) 未来due（まだ時間ではない）は最後の保険として box 小さい順で足す
  const future = withRec
    .filter((x) => x.rec && x.rec.lastAnswered > 0 && x.rec.dueAt > now)
    .sort(cmpDue(now))
    .map((x) => x.q)

  const queue = [...dueNow, ...unseen, ...future]
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
