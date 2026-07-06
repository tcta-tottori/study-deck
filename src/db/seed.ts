import { db, getSettings, updateSettings } from './db'
import type { Question } from '../types'
import { normalizeCategory } from '../lib/categoryMap'
import seedRaw from '../data/questions.seed.json'

/** seed のバージョン。seed を追記・修正したら上げると再取込される（既存の学習履歴は保持） */
const SEED_VERSION = 2

const seed = seedRaw as Question[]

/**
 * 初回起動時（または seed 更新時）に original 問題を Dexie へ取り込む。
 * - official 問題やユーザーが編集した note/aiExplanation は保持する。
 */
export async function ensureSeeded(): Promise<void> {
  const settings = await getSettings()
  if ((settings.seedVersion ?? 0) >= SEED_VERSION) return

  await db.transaction('rw', db.questions, async () => {
    for (const q of seed) {
      const existing = await db.questions.get(q.id)
      if (existing) {
        // ユーザー編集分（note/aiExplanation）を残して本文だけ更新
        await db.questions.put({
          ...q,
          note: existing.note,
          aiExplanation: existing.aiExplanation ?? q.aiExplanation,
        })
      } else {
        await db.questions.put(q)
      }
    }
  })

  await updateSettings({ seedVersion: SEED_VERSION })
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
