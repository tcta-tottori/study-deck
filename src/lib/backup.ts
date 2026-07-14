import { db, getSettings, updateSettings, type DayActivity } from '../db/db'
import type { StudyRecord, ExamResult, AppSettings } from '../types'

/**
 * 学習データのバックアップ／復元。
 * 対象は「端末内の学習成果」— SRS記録・日次活動（ストリーク）・模試履歴・設定・
 * 各問題に付けたメモ/AI解説。問題本文（公式過去問）は著作物のため含めず、取込データから
 * 別途取り込む前提とする（IDが一致すればメモとSRS記録は自動でひも付く）。
 *
 * APIキー（anthropicApiKey）は端末ローカルの秘密情報のためバックアップに含めない。
 */
export const BACKUP_KIND = 'studydrill-learning-data'
export const BACKUP_VERSION = 1

export interface NoteEntry {
  id: string
  note?: string
  aiExplanation?: string
}

export interface BackupFile {
  app: 'studydrill'
  kind: typeof BACKUP_KIND
  version: number
  exportedAt: number
  studyRecords: StudyRecord[]
  activity: DayActivity[]
  examResults: ExamResult[]
  settings: Partial<AppSettings>
  notes: NoteEntry[]
}

export interface RestoreReport {
  studyRecords: number
  activity: number
  examResults: number
  notesApplied: number
  notesPending: number
}

/** 現在の学習データをまとめて1つのバックアップオブジェクトにする */
export async function buildBackup(): Promise<BackupFile> {
  const [studyRecords, activity, examResults, settings, questions] = await Promise.all([
    db.studyRecords.toArray(),
    db.activity.toArray(),
    db.examResults.toArray(),
    getSettings(),
    db.questions.toArray(),
  ])

  const notes: NoteEntry[] = questions
    .filter((q) => (q.note && q.note.trim()) || (q.aiExplanation && q.aiExplanation.trim()))
    .map((q) => ({ id: q.id, note: q.note, aiExplanation: q.aiExplanation }))

  // APIキーは含めない（端末ローカルの秘密情報）
  const { anthropicApiKey: _omit, ...safeSettings } = settings

  return {
    app: 'studydrill',
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    studyRecords,
    activity,
    examResults,
    settings: safeSettings,
    notes,
  }
}

/** バックアップJSON文字列を生成（ダウンロード用） */
export async function exportBackupJson(): Promise<string> {
  return JSON.stringify(await buildBackup(), null, 2)
}

/** バックアップファイル名（studydrill-backup-YYYYMMDD-HHmm.json） */
export function backupFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `studydrill-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`
}

function isBackup(o: unknown): o is BackupFile {
  if (typeof o !== 'object' || o === null) return false
  const b = o as Record<string, unknown>
  return (
    b.app === 'studydrill' &&
    b.kind === BACKUP_KIND &&
    Array.isArray(b.studyRecords) &&
    Array.isArray(b.activity) &&
    Array.isArray(b.examResults)
  )
}

/**
 * バックアップJSONから学習データを復元する。
 * SRS記録・活動・模試履歴は「置き換え」、設定はマージ、メモは既存問題に適用する。
 * メモの対象問題がまだ取り込まれていない場合は notesPending として件数を返す
 * （公式過去問を取り込んでからもう一度復元すれば適用される）。
 */
export async function restoreBackup(text: string): Promise<RestoreReport> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new Error(`JSONの解析に失敗しました: ${(e as Error).message}`)
  }
  if (!isBackup(parsed)) {
    throw new Error('これはStudyDrillの学習データバックアップではありません。')
  }
  const b = parsed

  let notesApplied = 0
  let notesPending = 0

  await db.transaction(
    'rw',
    db.studyRecords,
    db.activity,
    db.examResults,
    db.questions,
    db.settings,
    async () => {
      // 学習系テーブルは置き換え（復元の意味に合わせる）
      await db.studyRecords.clear()
      if (b.studyRecords.length) await db.studyRecords.bulkPut(b.studyRecords)
      await db.activity.clear()
      if (b.activity.length) await db.activity.bulkPut(b.activity)
      await db.examResults.clear()
      if (b.examResults.length) await db.examResults.bulkPut(b.examResults)

      // メモ／AI解説は、その問題が取込済みの場合のみ適用
      for (const n of b.notes ?? []) {
        const q = await db.questions.get(n.id)
        if (q) {
          await db.questions.put({ ...q, note: n.note, aiExplanation: n.aiExplanation })
          notesApplied++
        } else {
          notesPending++
        }
      }
    },
  )

  // 設定はマージ（APIキーはバックアップに無いので現在の値を維持）。key は固定。
  if (b.settings && typeof b.settings === 'object') {
    const { key: _k, anthropicApiKey: _a, ...rest } = b.settings as AppSettings
    await updateSettings(rest)
  }

  return {
    studyRecords: b.studyRecords.length,
    activity: b.activity.length,
    examResults: b.examResults.length,
    notesApplied,
    notesPending,
  }
}
