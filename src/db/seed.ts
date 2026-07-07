import { db, getSettings, updateSettings } from './db'
import type { Question } from '../types'
import { normalizeCategory } from '../lib/categoryMap'

/**
 * 同梱のオリジナル練習問題（origin: 'original'）は廃止し、
 * 出題プールは取込んだ公式過去問（origin: 'official'）のみに限定する。
 *
 * 既に配信済みの端末には過去のシードで取り込んだ original 問題が残っているため、
 * 一度きりの移行でそれらと対応する学習履歴を削除する。
 * ユーザーが取り込んだ official 問題・note・aiExplanation は保持する。
 */
export async function purgeOriginalQuestions(): Promise<void> {
  const KEY = 'orig-purged-v1'
  if (localStorage.getItem(KEY)) return

  await db.transaction('rw', db.questions, db.studyRecords, async () => {
    const originals = await db.questions.where('origin').equals('original').toArray()
    if (originals.length) {
      const ids = originals.map((q) => q.id)
      await db.questions.bulkDelete(ids)
      await db.studyRecords.bulkDelete(ids)
    }
  })

  localStorage.setItem(KEY, '1')
}

/**
 * ベースカラーを白（ライト）に統一するための一度きりの移行。
 * 旧既定 'auto'（＝端末がダーク時はダーク表示）だった端末を 'light' に寄せる。
 * 端末ごとに1回だけ実行。以後ユーザーがテーマを選び直せばそれを尊重する。
 */
export async function migrateThemeBase(): Promise<void> {
  const KEY = 'theme-base-migrated-v1'
  if (localStorage.getItem(KEY)) return
  const s = await getSettings()
  if (s.theme === 'auto') await updateSettings({ theme: 'light' })
  localStorage.setItem(KEY, '1')
}

/**
 * 旧14分類で取り込んだ問題（公式問題）を新7分類へ寄せる一度きりの移行。
 */
export async function migrateCategories(): Promise<void> {
  const KEY = 'cat-migrated-v1'
  if (localStorage.getItem(KEY)) return
  const all = await db.questions.toArray()
  const updates = all
    .map((q) => {
      const norm = normalizeCategory(q.category as string)
      return norm && norm !== q.category ? { ...q, category: norm } : null
    })
    .filter((q): q is Question => q !== null)
  if (updates.length) await db.questions.bulkPut(updates)
  localStorage.setItem(KEY, '1')
}
