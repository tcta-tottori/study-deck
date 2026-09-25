/**
 * 音声解説の「原稿」を、端末内のデータ（問題・解説・誤答ログ・SRS記録）だけから組み立てる。
 *
 * 外部APIは使わない。問題データに入っている explanation / choiceReasons を、
 * 耳で聞いて分かる順番（見出し → 問題 → 正解 → 自分の解答 → 理由）に並べ直すのが役割。
 * 出力は「表示用のセクション」と「読み上げ用のセグメント」の両方を持つ。
 */
import type { Question, StudyRecord, WrongLog } from '../types'
import { splitForSpeech } from './tts'
import { questionSourceLabel } from './exam'
import type { DayActivity } from '../db/db'

export type VoiceMode = 'today' | 'weak'

export interface ScriptBlock {
  /** 画面に出す文（読み上げ用には内部でセグメント分割される） */
  text: string
  kind: 'intro' | 'stem' | 'answer' | 'mine' | 'reason' | 'why' | 'note' | 'outro'
  /** 「正解の理由」などの見出し（任意） */
  label?: string
}

export interface ScriptSection {
  key: string
  heading: string
  sub?: string
  questionId?: string
  blocks: ScriptBlock[]
}

export interface VoiceScript {
  mode: VoiceMode
  title: string
  /** 画面のサブタイトル（対象件数など） */
  summary: string
  sections: ScriptSection[]
  /** 読み上げセグメント（この配列が TtsPlayer のキューになる） */
  segments: string[]
  /** segments のインデックス → [sectionIndex, blockIndex] の対応 */
  map: { section: number; block: number }[]
  /** 読み上げ対象が無い場合の案内（空文字なら通常表示） */
  emptyMessage?: string
}

export interface ScriptOptions {
  /** 問題文を読み上げるか（既定true。false なら正解と理由だけ） */
  includeStem?: boolean
  /** 「苦手・頻出」モードで読み上げる問題数 */
  weakLimit?: number
}

const LETTERS = ['ア', 'イ', 'ウ', 'エ']

/** 問題文が長いときの読み上げ上限（聞き疲れ防止。以降は「詳しくは画面で」と案内） */
const STEM_LIMIT = 220

/**
 * 当日の誤答をふりかえる原稿。
 * 同じ問題を複数回間違えている場合は1問にまとめ、最後に選んだ誤答を採用する。
 */
export function buildTodayScript(
  questions: Question[],
  logs: WrongLog[],
  today: DayActivity | undefined,
  opts: ScriptOptions = {},
): VoiceScript {
  const byId = new Map(questions.map((q) => [q.id, q]))
  // 同一問題は最後の誤答にまとめる（回数も数えて読み上げに使う）
  const picked = new Map<string, { log: WrongLog; times: number }>()
  for (const l of logs) {
    const cur = picked.get(l.questionId)
    if (cur) picked.set(l.questionId, { log: l, times: cur.times + 1 })
    else picked.set(l.questionId, { log: l, times: 1 })
  }
  const items = [...picked.values()].filter((x) => byId.has(x.log.questionId))

  const count = today?.count ?? 0
  const correct = today?.correct ?? 0
  const pct = count > 0 ? Math.round((correct / count) * 100) : 0

  const sections: ScriptSection[] = []
  if (items.length === 0) {
    const msg =
      count > 0
        ? `今日は${count}問すべて正解でした。すばらしい調子です。間違いが出たら、ここで音声のふりかえりができます。`
        : '今日はまだ学習の記録がありません。1問でも解いてから、ここでふりかえりましょう。'
    sections.push({
      key: 'intro',
      heading: '今日のふりかえり',
      blocks: [{ text: msg, kind: 'intro' }],
    })
    return finalize({
      mode: 'today',
      title: '今日の間違い',
      summary: count > 0 ? `今日 ${count}問・誤答 0問` : '今日の学習はまだです',
      sections,
      emptyMessage: msg,
    })
  }

  const intro =
    `今日のふりかえりです。今日は${count}問解いて、${correct}問正解、正答率は${pct}パーセントでした。` +
    `間違えたのは${items.length}問です。順番に確認していきましょう。`
  sections.push({
    key: 'intro',
    heading: '今日のふりかえり',
    sub: `${count}問・正答率${pct}%`,
    blocks: [{ text: intro, kind: 'intro' }],
  })

  items.forEach((it, i) => {
    const q = byId.get(it.log.questionId)!
    sections.push(
      questionSection(q, it.log.chosen, i + 1, items.length, opts, {
        repeat: it.times,
        fromExam: it.log.mode === 'exam',
      }),
    )
  })

  sections.push({
    key: 'outro',
    heading: 'まとめ',
    blocks: [
      {
        text:
          `以上、今日の間違い${items.length}問でした。` +
          'もう一度聞き直すか、間違い復習でそのまま解き直すと定着します。おつかれさまでした。',
        kind: 'outro',
      },
    ],
  })

  return finalize({
    mode: 'today',
    title: '今日の間違い',
    summary: `誤答 ${items.length}問 ／ 今日 ${count}問・正答率${pct}%`,
    sections,
  })
}

/**
 * 全体を通して間違いの多い問題をふりかえる原稿。
 * 誤答ログ（直近）とSRS記録の誤答回数を合算し、誤答回数が多く正答率が低い順に選ぶ。
 */
export function buildWeakScript(
  questions: Question[],
  records: Map<string, StudyRecord>,
  recentLogs: WrongLog[],
  opts: ScriptOptions = {},
): VoiceScript {
  const limit = Math.max(1, opts.weakLimit ?? 5)

  // 直近の誤答ログから「最後に選んだ誤答」を拾う（無ければSRSの lastWrongChoice）
  const lastChosen = new Map<string, number>()
  for (const l of [...recentLogs].sort((a, b) => a.at - b.at)) lastChosen.set(l.questionId, l.chosen)

  interface Cand {
    q: Question
    wrong: number
    attempts: number
    accuracy: number
    chosen: number
  }
  const cands: Cand[] = []
  for (const q of questions) {
    const r = records.get(q.id)
    if (!r || r.wrongCount === 0) continue
    const attempts = r.correctCount + r.wrongCount
    cands.push({
      q,
      wrong: r.wrongCount,
      attempts,
      accuracy: attempts > 0 ? r.correctCount / attempts : 0,
      chosen: lastChosen.get(q.id) ?? r.lastWrongChoice ?? -1,
    })
  }
  // 誤答回数が多い順 → 正答率が低い順 → box が小さい順（＝まだ定着していない）
  cands.sort(
    (a, b) =>
      b.wrong - a.wrong ||
      a.accuracy - b.accuracy ||
      (records.get(a.q.id)?.box ?? 5) - (records.get(b.q.id)?.box ?? 5),
  )
  const items = cands.slice(0, limit)

  // カテゴリ別の苦手（読み上げの冒頭サマリに使う）
  const catAgg = new Map<string, { correct: number; wrong: number }>()
  for (const q of questions) {
    const r = records.get(q.id)
    if (!r || r.lastAnswered === 0) continue
    const a = catAgg.get(q.category) ?? { correct: 0, wrong: 0 }
    a.correct += r.correctCount
    a.wrong += r.wrongCount
    catAgg.set(q.category, a)
  }
  const weakCats = [...catAgg.entries()]
    .map(([cat, a]) => ({ cat, acc: a.correct + a.wrong > 0 ? a.correct / (a.correct + a.wrong) : 0, n: a.correct + a.wrong }))
    .filter((c) => c.n >= 3)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 3)

  const sections: ScriptSection[] = []

  if (items.length === 0) {
    const msg =
      '間違いの記録がまだありません。学習を進めると、よく間違える問題をここでまとめて聞けるようになります。'
    sections.push({ key: 'intro', heading: '苦手のふりかえり', blocks: [{ text: msg, kind: 'intro' }] })
    return finalize({
      mode: 'weak',
      title: '苦手・頻出の間違い',
      summary: '誤答の記録はまだありません',
      sections,
      emptyMessage: msg,
    })
  }

  let totalCorrect = 0
  let totalWrong = 0
  for (const r of records.values()) {
    totalCorrect += r.correctCount
    totalWrong += r.wrongCount
  }
  const overall = totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0

  const catLine =
    weakCats.length > 0
      ? `正答率が低い分野は、${weakCats
          .map((c) => `${c.cat}が${Math.round(c.acc * 100)}パーセント`)
          .join('、')}です。`
      : ''
  const intro =
    `これまでの学習全体のふりかえりです。通算の正答率は${overall}パーセント。` +
    catLine +
    `この中から、特に間違いの多い問題を${items.length}問、確認していきましょう。`

  sections.push({
    key: 'intro',
    heading: '苦手のふりかえり',
    sub: `通算正答率 ${overall}%`,
    blocks: [{ text: intro, kind: 'intro' }],
  })

  items.forEach((it, i) => {
    sections.push(
      questionSection(it.q, it.chosen, i + 1, items.length, opts, {
        wrongCount: it.wrong,
        attempts: it.attempts,
      }),
    )
  })

  sections.push({
    key: 'outro',
    heading: 'まとめ',
    blocks: [
      {
        text:
          `以上、間違いの多い${items.length}問でした。` +
          '聞いたあとに間違い復習で解き直すと、記憶に残りやすくなります。おつかれさまでした。',
        kind: 'outro',
      },
    ],
  })

  return finalize({
    mode: 'weak',
    title: '苦手・頻出の間違い',
    summary: `対象 ${items.length}問 ／ 通算正答率 ${overall}%`,
    sections,
  })
}

/** 1問ぶんの読み上げセクション（見出し → 問題 → 正解 → 自分の解答 → 理由） */
function questionSection(
  q: Question,
  chosen: number,
  no: number,
  total: number,
  opts: ScriptOptions,
  meta: { repeat?: number; fromExam?: boolean; wrongCount?: number; attempts?: number } = {},
): ScriptSection {
  const blocks: ScriptBlock[] = []
  const src = questionSourceLabel(q.id)

  let head = `${no}問目。分野は${q.category}。`
  if (meta.repeat && meta.repeat > 1) head += `今日${meta.repeat}回間違えています。`
  else if (meta.wrongCount && meta.attempts) {
    head += `これまで${meta.attempts}回中${meta.wrongCount}回間違えています。`
  }
  if (meta.fromExam) head += '本番シミュレーションでの誤答です。'
  blocks.push({ text: head, kind: 'intro' })

  if (opts.includeStem !== false) {
    const stem = q.stem.length > STEM_LIMIT ? `${q.stem.slice(0, STEM_LIMIT)}、以下は画面で確認してください。` : q.stem
    blocks.push({ text: `問題。${stem}`, kind: 'stem', label: '問題' })
  }

  const ansLetter = LETTERS[q.answerIndex]
  blocks.push({
    text: `正解は${ansLetter}。${q.choices[q.answerIndex]}。`,
    kind: 'answer',
    label: '正解',
  })

  if (chosen >= 0 && chosen !== q.answerIndex) {
    blocks.push({
      text: `あなたが選んだのは${LETTERS[chosen]}、${q.choices[chosen]}、でした。`,
      kind: 'mine',
      label: 'あなたの解答',
    })
  } else if (chosen < 0) {
    blocks.push({ text: 'この問題は未回答のまま提出されています。', kind: 'mine', label: 'あなたの解答' })
  }

  if (q.explanation) {
    blocks.push({ text: `正解の理由。${q.explanation}`, kind: 'reason', label: '正解の理由' })
  }

  // 自分が選んだ誤答の理由を最優先で読む（次に他の誤答肢）
  const reasons = q.choiceReasons
  if (reasons && reasons.length === 4) {
    const order = [
      ...(chosen >= 0 && chosen !== q.answerIndex ? [chosen] : []),
      ...q.choices.map((_, i) => i).filter((i) => i !== q.answerIndex && i !== chosen),
    ]
    for (const i of order) {
      const r = stripMark(reasons[i] ?? '')
      if (!r) continue
      const prefix = i === chosen ? `あなたが選んだ${LETTERS[i]}が違う理由。` : `${LETTERS[i]}が違う理由。`
      blocks.push({ text: prefix + r, kind: 'why', label: `${LETTERS[i]}が違う理由` })
    }
  }

  if (q.aiExplanation) {
    blocks.push({ text: `補足。${q.aiExplanation}`, kind: 'note', label: '補足解説' })
  }
  if (q.note) {
    blocks.push({ text: `あなたのメモ。${q.note}`, kind: 'note', label: 'メモ' })
  }

  return {
    key: `q-${q.id}-${no}`,
    heading: `${no}問目 / ${total}問`,
    sub: src ? `${q.category}・${src}` : q.category,
    questionId: q.id,
    blocks,
  }
}

/** 理由文の先頭に付いた ○/×/・ 等の記号を落とす（音声では記号を読まないため） */
function stripMark(s: string): string {
  return s.replace(/^\s*[○◯✓〇×✕✗＊*・\-—–\s]+/, '').trim()
}

/** セクション → 読み上げセグメント列と対応表を作る */
function finalize(
  base: Omit<VoiceScript, 'segments' | 'map'>,
): VoiceScript {
  const segments: string[] = []
  const map: { section: number; block: number }[] = []
  base.sections.forEach((sec, si) => {
    sec.blocks.forEach((b, bi) => {
      for (const seg of splitForSpeech(b.text)) {
        segments.push(seg)
        map.push({ section: si, block: bi })
      }
    })
  })
  return { ...base, segments, map }
}

/** セグメント番号からセクションの先頭セグメント番号を引く（セクション送り用） */
export function sectionStarts(script: VoiceScript): number[] {
  const starts: number[] = []
  let cur = -1
  script.map.forEach((m, i) => {
    if (m.section !== cur) {
      starts.push(i)
      cur = m.section
    }
  })
  return starts
}

/** 読み上げ全体のおおよその所要秒（速度を加味。表示用の目安） */
export function estimateSeconds(script: VoiceScript, rate = 1): number {
  const chars = script.segments.reduce((n, s) => n + s.length, 0)
  return Math.round(chars / (7 * Math.max(0.5, rate)))
}
