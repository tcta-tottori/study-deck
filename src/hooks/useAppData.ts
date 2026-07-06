import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, DEFAULT_SETTINGS } from '../db/db'
import type { Question, StudyRecord } from '../types'
import { dayKey } from '../lib/dateutil'

export function useSettings() {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
}

export function useQuestions(): Question[] | undefined {
  return useLiveQuery(() => db.questions.toArray(), [])
}

export function useRecordsMap(): Map<string, StudyRecord> | undefined {
  return useLiveQuery(async () => {
    const recs = await db.studyRecords.toArray()
    return new Map(recs.map((r) => [r.questionId, r]))
  }, [])
}

export function useActivity() {
  return useLiveQuery(() => db.activity.toArray(), [])
}

export function useExamResults() {
  return useLiveQuery(() => db.examResults.orderBy('takenAt').toArray(), [])
}

/** 今日の回答数と1日の目標（回答するたびリアルタイム更新） */
export function useTodayProgress(): { count: number; goal: number } {
  return (
    useLiveQuery(async () => {
      const s = await getSettings()
      const a = await db.activity.get(dayKey(Date.now()))
      return { count: a?.count ?? 0, goal: s.dailyGoal }
    }, []) ?? { count: 0, goal: DEFAULT_SETTINGS.dailyGoal }
  )
}
