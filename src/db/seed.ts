import { db, getSettings, updateSettings } from './db'
import type { Question } from '../types'
import seedRaw from '../data/questions.seed.json'

/** seed のバージョン。seed を追記・修正したら上げると再取込される（既存の学習履歴は保持） */
const SEED_VERSION = 1

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
