import type { Question } from '../types'
import { shuffle } from '../srs/srs'

/**
 * 本番シミュレーションの出題ロジック。
 * - 過去問を「年度・前後期」ごと（＝1回分）に受験できる。
 * - もしくは全分野からバランスよくランダム出題する。
 *
 * 公式問題のIDは OFF-R{YY}{E|L}-{NNNN}（E=前期 / L=後期）で年度・回を表す。
 * 例: OFF-R07L-0001 → 令和7年度 後期。ここから受験可能な回を自動抽出する。
 */

export interface ExamSession {
  key: string // "R07L"
  year: number // 令和N
  term: 'early' | 'late'
  label: string // "令和7年度 後期"
  count: number
}

/** 公式問題ID（OFF-R{YY}{E|L}-…）から年度・期を抽出。該当しなければ null */
export function parseSessionKey(
  id: string,
): { key: string; year: number; term: 'early' | 'late' } | null {
  const m = /^OFF-R(\d{1,2})(E|L)/i.exec(id)
  if (!m) return null
  const term = m[2].toUpperCase() === 'E' ? 'early' : 'late'
  return { key: `R${m[1].padStart(2, '0')}${term === 'early' ? 'E' : 'L'}`, year: Number(m[1]), term }
}

export function sessionLabel(year: number, term: 'early' | 'late'): string {
  return `令和${year}年度 ${term === 'early' ? '前期' : '後期'}`
}

/**
 * 問題IDから「令和7年度 後期 問15」形式の出典ラベルを作る。
 * 公式ID（OFF-R{YY}{E|L}-{NN}）以外は null。
 */
export function questionSourceLabel(id: string): string | null {
  const m = /^OFF-R(\d{1,2})(E|L)-0*(\d+)/i.exec(id)
  if (!m) return null
  const term = m[2].toUpperCase() === 'E' ? 'early' : 'late'
  return `${sessionLabel(Number(m[1]), term)} 問${Number(m[3])}`
}

/** 取込済み問題から受験可能な回の一覧（新しい年度→古い、同年度は後期→前期の順） */
export function listSessions(questions: Question[]): ExamSession[] {
  const map = new Map<string, ExamSession>()
  for (const q of questions) {
    const p = parseSessionKey(q.id)
    if (!p) continue
    const ex = map.get(p.key)
    if (ex) ex.count++
    else
      map.set(p.key, {
        key: p.key,
        year: p.year,
        term: p.term,
        label: sessionLabel(p.year, p.term),
        count: 1,
      })
  }
  return [...map.values()].sort(
    (a, b) => b.year - a.year || (a.term === b.term ? 0 : a.term === 'late' ? -1 : 1),
  )
}

/** 指定した回（年度・前後期）の問題を出題順（ID昇順）で返す */
export function questionsForSession(questions: Question[], key: string): Question[] {
  return questions
    .filter((q) => parseSessionKey(q.id)?.key === key)
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * 全分野からバランスよく n 問を選ぶ。
 * 各分野の出題数がプールの分野比率に概ね比例するよう、
 * 「最も割当が遅れている分野」から1問ずつ引く重み付きラウンドロビンで選定する。
 * 返り値はシャッフル済み。プールが n 未満なら全部返す。
 */
export function pickBalanced(questions: Question[], n: number): Question[] {
  const total = questions.length
  const target = Math.min(n, total)
  if (target === 0) return []

  // 分野ごとにシャッフルして格納
  const pools = new Map<string, Question[]>()
  for (const q of questions) {
    const arr = pools.get(q.category) ?? []
    arr.push(q)
    pools.set(q.category, arr)
  }
  const cats = [...pools.entries()].map(([c, arr]) => ({
    cat: c,
    arr: shuffle(arr),
    taken: 0,
    share: arr.length / total, // 目標比率
  }))

  const picked: Question[] = []
  while (picked.length < target) {
    let best: (typeof cats)[number] | null = null
    let bestDeficit = -Infinity
    for (const c of cats) {
      if (c.taken >= c.arr.length) continue
      // これまでの合計に対して、この分野がどれだけ「比率より遅れているか」
      const deficit = c.share * (picked.length + 1) - c.taken
      if (deficit > bestDeficit) {
        bestDeficit = deficit
        best = c
      }
    }
    if (!best) break
    picked.push(best.arr[best.taken++])
  }
  return shuffle(picked)
}
