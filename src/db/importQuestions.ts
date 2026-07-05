import { db } from './db'
import { CATEGORIES, type Category, type Question, type AnswerIndex } from '../types'

export interface ImportReport {
  ok: boolean
  added: number
  updated: number
  errors: string[]
  total: number
}

const CATEGORY_SET = new Set<string>(CATEGORIES)

function validateQuestion(q: unknown, idx: number, seenIds: Set<string>): { q?: Question; error?: string } {
  const where = `#${idx + 1}`
  if (typeof q !== 'object' || q === null) return { error: `${where}: オブジェクトではありません` }
  const o = q as Record<string, unknown>

  const id = o.id
  if (typeof id !== 'string' || id.trim() === '') return { error: `${where}: id が不正` }
  if (seenIds.has(id)) return { error: `${where}: id が重複 (${id})` }

  const category = o.category
  if (typeof category !== 'string' || !CATEGORY_SET.has(category))
    return { error: `${where} (${id}): category が不正 (${String(category)})` }

  const stem = o.stem
  if (typeof stem !== 'string' || stem.trim() === '') return { error: `${where} (${id}): stem が空` }

  const choices = o.choices
  if (!Array.isArray(choices) || choices.length !== 4 || choices.some((c) => typeof c !== 'string'))
    return { error: `${where} (${id}): choices は文字列4つが必要` }

  const answerIndex = o.answerIndex
  if (typeof answerIndex !== 'number' || ![0, 1, 2, 3].includes(answerIndex))
    return { error: `${where} (${id}): answerIndex は0〜3` }

  const origin = o.origin === 'original' ? 'original' : 'official'

  seenIds.add(id)
  return {
    q: {
      id,
      origin,
      category: category as Category,
      subcategory: typeof o.subcategory === 'string' ? o.subcategory : undefined,
      stem,
      choices: choices as [string, string, string, string],
      answerIndex: answerIndex as AnswerIndex,
      explanation: typeof o.explanation === 'string' ? o.explanation : '',
      source: typeof o.source === 'string' ? o.source : undefined,
    },
  }
}

/** JSON文字列（Question配列）をパースして取込む */
export async function importFromJson(text: string): Promise<ImportReport> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { ok: false, added: 0, updated: 0, total: 0, errors: [`JSONの解析に失敗: ${(e as Error).message}`] }
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed]
  return commit(arr)
}

/**
 * CSVを取込む。
 * 列: id, category, subcategory, stem, choice1, choice2, choice3, choice4, answerIndex, explanation, source
 * 先頭行がヘッダの場合は自動判定。answerIndex は 0-3（または 1-4 を許容）。
 */
export async function importFromCsv(text: string): Promise<ImportReport> {
  const rows = parseCsv(text)
  if (rows.length === 0) return { ok: false, added: 0, updated: 0, total: 0, errors: ['空のCSVです'] }

  let start = 0
  const header = rows[0].map((c) => c.trim().toLowerCase())
  if (header.includes('id') && header.includes('stem')) start = 1

  const objs: unknown[] = []
  const errors: string[] = []
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]
    if (r.length === 1 && r[0].trim() === '') continue // 空行
    if (r.length < 9) {
      errors.push(`行${i + 1}: 列数が不足 (${r.length}列)`) // id..answerIndex まで最低9列
      continue
    }
    let ans = Number(r[8])
    if (ans >= 1 && ans <= 4) ans = ans - 1 // 1-4 表記を 0-3 に補正
    objs.push({
      id: r[0]?.trim(),
      category: r[1]?.trim(),
      subcategory: r[2]?.trim() || undefined,
      stem: r[3],
      choices: [r[4], r[5], r[6], r[7]],
      answerIndex: ans,
      explanation: r[9] ?? '',
      source: r[10] ?? undefined,
      origin: 'official',
    })
  }

  const rep = await commit(objs)
  return { ...rep, errors: [...errors, ...rep.errors], ok: rep.ok && errors.length === 0 }
}

async function commit(arr: unknown[]): Promise<ImportReport> {
  const errors: string[] = []
  const valid: Question[] = []
  const seen = new Set<string>()

  arr.forEach((item, i) => {
    const { q, error } = validateQuestion(item, i, seen)
    if (error) errors.push(error)
    else if (q) valid.push(q)
  })

  let added = 0
  let updated = 0
  if (valid.length > 0) {
    await db.transaction('rw', db.questions, async () => {
      for (const q of valid) {
        const exists = await db.questions.get(q.id)
        if (exists) {
          await db.questions.put({ ...q, note: exists.note, aiExplanation: exists.aiExplanation })
          updated++
        } else {
          await db.questions.put(q)
          added++
        }
      }
    })
  }

  return { ok: errors.length === 0, added, updated, total: valid.length, errors }
}

/** RFC4180風の簡易CSVパーサ（ダブルクォート・改行・カンマ対応） */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') {
        row.push(field)
        field = ''
      } else if (c === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      } else {
        field += c
      }
    }
  }
  // 末尾
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export const CSV_TEMPLATE = `id,category,subcategory,stem,choice1,choice2,choice3,choice4,answerIndex,explanation,source
OFF-R06L-0001,共通_品質管理,QC七つ道具,"問題文をここに（カンマや改行を含む場合は""で囲む）",選択肢ア,選択肢イ,選択肢ウ,選択肢エ,1,解説をここに,R6後-041B01
`
