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
    dueAt: now, // 当日中に再登場
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
  const { now, categories, wrongOnly, limit } = opts

  let pool = questions
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

  const dueNow = withRec
    .filter((x) => x.rec && x.rec.dueAt <= now)
    .sort(cmpDue(now))
    .map((x) => x.q)

  const unseen = shuffle(withRec.filter((x) => !x.rec).map((x) => x.q))

  // 未来due（まだ時間ではない）は最後の保険として box 小さい順で足す
  const future = withRec
    .filter((x) => x.rec && x.rec.dueAt > now)
    .sort(cmpDue(now))
    .map((x) => x.q)

  const queue = [...dueNow, ...unseen, ...future]
  return limit ? queue.slice(0, limit) : queue
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
