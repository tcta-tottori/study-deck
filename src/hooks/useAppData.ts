import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, DEFAULT_SETTINGS, loadSubjectQuestions } from '../db/db'
import { filterBySubject } from '../lib/subjects'
import type { Question, StudyRecord } from '../types'
import { dayKey } from '../lib/dateutil'

export function useSettings() {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
}

/** いま選んでいる科目の問題だけ（科目を切り替えると自動で入れ替わる） */
export function useQuestions(): Question[] | undefined {
  return useLiveQuery(() => loadSubjectQuestions(), [])
}

/** いま選んでいる科目の問題に対応する学習記録だけ（復習待ち件数・正答率が科目ごとになる） */
export function useRecordsMap(): Map<string, StudyRecord> | undefined {
  return useLiveQuery(async () => {
    const [qs, recs] = await Promise.all([loadSubjectQuestions(), db.studyRecords.toArray()])
    const ids = new Set(qs.map((q) => q.id))
    return new Map(recs.filter((r) => ids.has(r.questionId)).map((r) => [r.questionId, r]))
  }, [])
}

export function useActivity() {
  return useLiveQuery(() => db.activity.toArray(), [])
}

/** いま選んでいる科目の模試結果だけ */
export function useExamResults() {
  return useLiveQuery(async () => {
    const [s, all] = await Promise.all([getSettings(), db.examResults.orderBy('takenAt').toArray()])
    return filterBySubject(all, s.subjectId)
  }, [])
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
