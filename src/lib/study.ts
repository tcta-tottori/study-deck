import { db } from '../db/db'
import { applyAnswer, newRecord } from '../srs/srs'
import type { Question } from '../types'
import { dayKey } from './dateutil'

/**
 * 練習モードの1問回答を保存する（1問ごと即保存＝中断耐性）。
 * - SRSレコードを更新
 * - 日次アクティビティ（ストリーク/目標）を更新
 * 戻り値: 正誤
 */
export async function recordAnswer(question: Question, chosen: number): Promise<boolean> {
  const now = Date.now()
  const correct = chosen === question.answerIndex
  const key = dayKey(now)

  await db.transaction('rw', db.studyRecords, db.activity, async () => {
    const existing = (await db.studyRecords.get(question.id)) ?? newRecord(question.id, now)
    const updated = applyAnswer(existing, correct, now, chosen)
    await db.studyRecords.put(updated)

    const act = (await db.activity.get(key)) ?? { day: key, count: 0, correct: 0 }
    act.count += 1
    if (correct) act.correct += 1
    await db.activity.put(act)
  })

  return correct
}

/** 誤答ノート（自由記述メモ）を保存 */
export async function saveNote(questionId: string, note: string): Promise<void> {
  const q = await db.questions.get(questionId)
  if (!q) return
  await db.questions.put({ ...q, note })
}

/** AI/手入力の補足解説を保存 */
export async function saveAiExplanation(questionId: string, text: string): Promise<void> {
  const q = await db.questions.get(questionId)
  if (!q) return
  await db.questions.put({ ...q, aiExplanation: text })
}
