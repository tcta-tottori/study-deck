import { db, getSettings, updateSettings } from './db'
import type { Question } from '../types'
import { normalizeCategory } from '../lib/categoryMap'

/**
 * オリジナル（同梱の練習問題 origin==='original'）を廃止する一度きりの移行。
 * 公式過去問の取込で運用する方針に合わせ、同梱originalは自動投入しない。
 *
 * - 既存端末に残っている original 問題を削除する。
 * - それに紐づく studyRecords（宙に浮いた記録）も併せて削除し、
 *   「復習待ち」件数や正答率などの集計が実在しない問題で狂わないようにする。
 * - 連続学習日数（activity）・模試履歴（examResults）・公式問題のSRS記録は保持するため、
 *   学習の実績そのものには影響しない。
 * - 端末ごとに1回だけ実行する（localStorage フラグで管理）。
 */
export async function abolishOriginals(): Promise<void> {
  const KEY = 'originals-abolished-v1'
  if (localStorage.getItem(KEY)) return
  const ids = (await db.questions.where('origin').equals('original').primaryKeys()) as string[]
  if (ids.length) {
    await db.transaction('rw', db.questions, db.studyRecords, async () => {
      await db.questions.bulkDelete(ids)
      await db.studyRecords.bulkDelete(ids) // 宙に浮く記録だけ掃除。activity/examResults は触れない
    })
  }
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
 * 旧14分類で取り込んだ問題（主に公式問題）を新7分類へ寄せる一度きりの移行。
 * seed問題はseed再取込で更新されるが、公式問題はここで正規化する。
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
