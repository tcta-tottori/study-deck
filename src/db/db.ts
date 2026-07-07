import Dexie, { type Table } from 'dexie'
import type { Question, StudyRecord, ExamResult, AppSettings } from '../types'
import { DEFAULT_SUBJECT_ID } from '../lib/subjects'

/** 1日の学習量ログ（ストリーク・日次目標・活動グラフ用） */
export interface DayActivity {
  day: string // 'YYYY-MM-DD'（ローカル）
  count: number // その日に回答した問題数
  correct: number
}

export class StudyDB extends Dexie {
  questions!: Table<Question, string>
  studyRecords!: Table<StudyRecord, string>
  examResults!: Table<ExamResult, number>
  settings!: Table<AppSettings, string>
  activity!: Table<DayActivity, string>

  constructor() {
    super('study-deck')
    this.version(1).stores({
      questions: 'id, origin, category',
      studyRecords: 'questionId, box, dueAt, lastAnswered',
      examResults: '++id, takenAt',
      settings: 'key',
      activity: 'day',
    })
  }
}

export const db = new StudyDB()

export const DEFAULT_SETTINGS: AppSettings = {
  key: 'app',
  subjectId: DEFAULT_SUBJECT_ID,
  dailyGoal: 20,
  interleave: true,
  examDurationSec: 110 * 60, // 暫定110分
  examDate: '2026-10-04', // 試験日（既定 10月4日）。設定で変更可能。
  landscape: false,
  theme: 'light', // ベースは白（明るいテーマ）を既定に
  seedVersion: 0,
}

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get('app')
  if (!s) {
    await db.settings.put(DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }
  // 新規フィールドの後方互換
  return { ...DEFAULT_SETTINGS, ...s }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const cur = await getSettings()
  await db.settings.put({ ...cur, ...patch, key: 'app' })
}
