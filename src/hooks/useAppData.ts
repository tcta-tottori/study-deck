import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, DEFAULT_SETTINGS } from '../db/db'
import type { Question, StudyRecord } from '../types'

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
