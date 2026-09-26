/**
 * まとめノート（HTML形式の学習資料）の生成。
 *
 * 「項目（カテゴリ）ごとに、間違いが多いところ」または「その項目の全問題」を、
 * 印刷・保存して読めるHTMLに整形する。外部サービスは使わず、端末内のデータだけで完結する。
 * 生成したHTMLはアプリ内プレビュー（iframe）・ファイル保存・印刷の3つで同じものを使う。
 */
import type { Category, Question, StudyRecord } from '../types'
import { CATEGORIES } from '../types'
import { categoryColor } from './categoryMap'
import { questionSourceLabel } from './exam'

export type SheetScope = 'weak' | 'all'
export type SheetCategory = Category | 'all'

export interface SheetItem {
  q: Question
  attempts: number
  correctCount: number
  wrongCount: number
  /** 0..1（未学習は0） */
  accuracy: number
  box?: number
  /** 直近で選んだ誤答（無ければ undefined） */
  lastWrongChoice?: number
  unseen: boolean
}

export interface SheetStats {
  total: number
  answered: number
  unseen: number
  correct: number
  wrong: number
  /** 0..1 */
  accuracy: number
  /** 1回以上間違えた問題数 */
  weak: number
}

export interface StudySheet {
  category: SheetCategory
  categoryLabel: string
  scope: SheetScope
  color: string
  items: SheetItem[]
  stats: SheetStats
  generatedAt: number
}

export interface SheetOptions {
  category: SheetCategory
  scope: SheetScope
  /** 選択肢を載せるか（既定true） */
  includeChoices?: boolean
  /** 自分のメモ・AI解説を載せるか（既定true） */
  includeNotes?: boolean
}

const LETTERS = ['ア', 'イ', 'ウ', 'エ']

/** 対象カテゴリの問題を集計して、まとめノートの素材を作る */
export function buildStudySheet(
  questions: Question[],
  records: Map<string, StudyRecord>,
  opts: SheetOptions,
): StudySheet {
  const pool =
    opts.category === 'all' ? questions : questions.filter((q) => q.category === opts.category)

  const all: SheetItem[] = pool.map((q) => {
    const r = records.get(q.id)
    const attempts = r ? r.correctCount + r.wrongCount : 0
    return {
      q,
      attempts,
      correctCount: r?.correctCount ?? 0,
      wrongCount: r?.wrongCount ?? 0,
      accuracy: attempts > 0 ? (r?.correctCount ?? 0) / attempts : 0,
      box: r?.lastAnswered ? r.box : undefined,
      lastWrongChoice: r?.lastWrongChoice,
      unseen: !r || r.lastAnswered === 0,
    }
  })

  const stats: SheetStats = {
    total: all.length,
    answered: all.filter((x) => !x.unseen).length,
    unseen: all.filter((x) => x.unseen).length,
    correct: all.reduce((n, x) => n + x.correctCount, 0),
    wrong: all.reduce((n, x) => n + x.wrongCount, 0),
    accuracy: 0,
    weak: all.filter((x) => x.wrongCount > 0).length,
  }
  const denom = stats.correct + stats.wrong
  stats.accuracy = denom > 0 ? stats.correct / denom : 0

  const items =
    opts.scope === 'weak'
      ? all
          .filter((x) => x.wrongCount > 0)
          // 誤答回数が多い順 → 正答率が低い順 → ID順（同点は出題順で安定させる）
          .sort(
            (a, b) =>
              b.wrongCount - a.wrongCount ||
              a.accuracy - b.accuracy ||
              a.q.id.localeCompare(b.q.id),
          )
      : // 全問題はカテゴリ→ID順（過去問の出題順に近い並び）
        all.sort(
          (a, b) =>
            CATEGORIES.indexOf(a.q.category) - CATEGORIES.indexOf(b.q.category) ||
            a.q.id.localeCompare(b.q.id),
        )

  return {
    category: opts.category,
    categoryLabel: opts.category === 'all' ? '全カテゴリ' : opts.category,
    scope: opts.scope,
    color: opts.category === 'all' ? '#2347c5' : categoryColor(opts.category),
    items,
    stats,
    generatedAt: Date.now(),
  }
}

/**
 * カテゴリのASCIIスラッグ。ファイル名に日本語を使うと端末によっては
 * 「download」等に落ちてしまうため、保存名は半角英数のみで組み立てる
 * （資料のタイトル自体は日本語のまま）。
 */
const CATEGORY_SLUG: Record<Category, string> = {
  '製品企画・設計管理': 'design',
  '生産システム・生産計画': 'planning',
  '品質管理': 'quality',
  '原価管理': 'cost',
  '納期管理': 'delivery',
  '安全衛生管理': 'safety',
  '環境管理': 'environment',
}

/** ファイル名（studydrill-note-quality-weak-20260926.html） */
export function sheetFilename(sheet: StudySheet, now = new Date(sheet.generatedAt)): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
  const scope = sheet.scope === 'weak' ? 'weak' : 'all'
  const cat = sheet.category === 'all' ? 'all' : (CATEGORY_SLUG[sheet.category] ?? 'category')
  return `studydrill-note-${cat}-${scope}-${date}.html`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 理由文の先頭に付いた ○/×/・ 等の記号を落とす（資料側で記号を付け直すため） */
function stripMark(s: string): string {
  return s.replace(/^\s*[○◯✓〇×✕✗＊*・\-—–\s]+/, '').trim()
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * まとめノートを1枚の自己完結HTML（CSS埋め込み・外部通信なし）として生成する。
 * 保存してブラウザで開く／印刷してPDF化する用途を想定し、印刷時の体裁も整える。
 */
export function renderSheetHtml(
  sheet: StudySheet,
  opts: { theme?: 'light' | 'dark' | 'auto'; includeChoices?: boolean; includeNotes?: boolean } = {},
): string {
  const theme = opts.theme ?? 'auto'
  const includeChoices = opts.includeChoices !== false
  const includeNotes = opts.includeNotes !== false
  const scopeLabel = sheet.scope === 'weak' ? '間違いが多い問題' : 'この項目の全問題'
  const title = `${sheet.categoryLabel}｜${scopeLabel} — StudyDrill まとめノート`

  const toc = sheet.items
    .map((it, i) => {
      const badge =
        it.wrongCount > 0 ? `<span class="toc-wrong">誤答${it.wrongCount}</span>` : ''
      return `<li><a href="#q${i + 1}"><span class="toc-no">${String(i + 1).padStart(2, '0')}</span><span class="toc-text">${esc(
        it.q.stem.slice(0, 44),
      )}${it.q.stem.length > 44 ? '…' : ''}</span>${badge}</a></li>`
    })
    .join('\n')

  const body = sheet.items.map((it, i) => renderItem(it, i + 1, includeChoices, includeNotes)).join('\n')

  const empty =
    sheet.items.length === 0
      ? `<div class="empty">${
          sheet.scope === 'weak'
            ? 'この項目で間違えた問題はまだありません。全問題モードに切り替えるか、学習を進めてからもう一度作成してください。'
            : 'この項目に問題が取り込まれていません。取込画面から問題を追加してください。'
        }</div>`
      : ''

  return `<!doctype html>
<html lang="ja"${theme === 'auto' ? '' : ` data-theme="${theme}"`}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${SHEET_CSS}</style>
</head>
<body>
<div class="wrap${sheet.items.length >= 8 ? ' long' : ''}" style="--accent: ${sheet.color}">
  <header class="hero">
    <div class="kicker">StudyDrill まとめノート</div>
    <h1>${esc(sheet.categoryLabel)}</h1>
    <p class="scope">${scopeLabel}・${sheet.items.length}問<span class="dot">•</span>作成 ${fmtDate(sheet.generatedAt)}</p>
    <div class="stats">
      <div class="stat"><b>${Math.round(sheet.stats.accuracy * 100)}<small>%</small></b><span>正答率</span></div>
      <div class="stat"><b>${sheet.stats.total}</b><span>問題数</span></div>
      <div class="stat"><b>${sheet.stats.weak}</b><span>誤答あり</span></div>
      <div class="stat"><b>${sheet.stats.unseen}</b><span>未学習</span></div>
    </div>
  </header>
${empty}
${
  sheet.items.length > 0
    ? `  <nav class="toc" aria-label="目次">
    <h2>目次</h2>
    <ol>
${toc}
    </ol>
  </nav>

  <main>
${body}
  </main>`
    : ''
}
  <footer>
    StudyDrill — 生産管理プランニング3級 学習アプリ ／ 端末内のデータから作成（外部送信なし）。
    問題の著作権は出題元に帰属します。個人学習の範囲でご利用ください。
  </footer>
</div>
</body>
</html>`
}

function renderItem(it: SheetItem, no: number, includeChoices: boolean, includeNotes: boolean): string {
  const q = it.q
  const src = questionSourceLabel(q.id)
  const badges: string[] = []
  if (it.wrongCount > 0) {
    badges.push(
      `<span class="badge warn">${it.attempts > 0 ? `${it.attempts}回中` : ''}${it.wrongCount}回まちがい</span>`,
    )
  }
  if (it.unseen) badges.push('<span class="badge">未学習</span>')
  else if (it.box) badges.push(`<span class="badge">box ${it.box}</span>`)
  if (src) badges.push(`<span class="badge src">${esc(src)}</span>`)
  badges.push(`<span class="badge cat">${esc(q.category)}</span>`)

  const choices = includeChoices
    ? `    <ol class="choices">
${q.choices
  .map((c, i) => {
    const isAns = i === q.answerIndex
    const isMine = it.lastWrongChoice === i && !isAns
    const cls = ['choice', isAns ? 'ok' : 'ng', isMine ? 'mine' : ''].filter(Boolean).join(' ')
    const tag = isAns
      ? '<span class="tag ok">正解</span>'
      : isMine
        ? '<span class="tag ng">前回選んだ</span>'
        : ''
    return `      <li class="${cls}"><span class="mark">${LETTERS[i]}</span><span class="ctext">${esc(c)}</span>${tag}</li>`
  })
  .join('\n')}
    </ol>`
    : `    <p class="answer-only"><b>正解</b> ${LETTERS[q.answerIndex]}．${esc(q.choices[q.answerIndex])}</p>`

  const reasons = q.choiceReasons
  const others =
    reasons && reasons.length === 4
      ? `    <section class="why ng">
      <h3>ほかの選択肢が違う理由</h3>
      <ul>
${q.choices
  .map((_, i) => i)
  .filter((i) => i !== q.answerIndex)
  .map((i) => {
    const r = stripMark(reasons[i] ?? '')
    if (!r) return ''
    const mine = it.lastWrongChoice === i ? ' class="mine"' : ''
    return `        <li${mine}><b>${LETTERS[i]}</b>${esc(r)}</li>`
  })
  .filter(Boolean)
  .join('\n')}
      </ul>
    </section>`
      : ''

  const explanation = q.explanation
    ? `    <section class="why ok">
      <h3>正解の理由</h3>
      <p>${esc(q.explanation)}</p>
    </section>`
    : ''

  const extra =
    includeNotes && (q.aiExplanation || q.note)
      ? `    <section class="memo">
${q.aiExplanation ? `      <p><b>補足解説</b>${esc(q.aiExplanation)}</p>` : ''}
${q.note ? `      <p><b>自分のメモ</b>${esc(q.note)}</p>` : ''}
    </section>`
      : ''

  return `    <article class="q" id="q${no}">
    <div class="q-head">
      <span class="no">${String(no).padStart(2, '0')}</span>
      <span class="badges">${badges.join('')}</span>
    </div>
    <p class="stem">${esc(q.stem)}</p>
${choices}
${explanation}
${others}
${extra}
    </article>`
}

/** 生成HTMLに埋め込むCSS（外部フォント・外部CSSは読み込まない） */
const SHEET_CSS = `
:root {
  --bg: #f6f8fc;
  --surface: #ffffff;
  --text: #16203a;
  --dim: #6b7690;
  --line: #e4eaf4;
  --ok: #17a34a;
  --ok-bg: #e9f8ef;
  --ng: #d9443f;
  --ng-bg: #fdeceb;
  --accent: #2347c5;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #0a1122;
    --surface: #121c33;
    --text: #e9eefb;
    --dim: #93a1bd;
    --line: #24324f;
    --ok: #34d17a;
    --ok-bg: #12331f;
    --ng: #f8736f;
    --ng-bg: #3a1a1c;
  }
}
:root[data-theme='dark'] {
  --bg: #0a1122;
  --surface: #121c33;
  --text: #e9eefb;
  --dim: #93a1bd;
  --line: #24324f;
  --ok: #34d17a;
  --ok-bg: #12331f;
  --ng: #f8736f;
  --ng-bg: #3a1a1c;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  line-height: 1.75;
  letter-spacing: 0.01em;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 760px; margin: 0 auto; padding: 22px 18px 56px; }
.hero {
  background: linear-gradient(150deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #0b1738));
  color: #fff;
  border-radius: 22px;
  padding: 24px 22px;
  margin-bottom: 20px;
}
.kicker { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.8; font-weight: 700; }
.hero h1 { margin: 6px 0 4px; font-size: 27px; line-height: 1.35; font-weight: 800; }
.scope { margin: 0; font-size: 13px; opacity: 0.92; }
.scope .dot { margin: 0 8px; opacity: 0.6; }
.stats { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.stat {
  flex: 1 1 88px;
  background: rgba(255,255,255,0.15);
  border-radius: 14px;
  padding: 10px 12px;
  text-align: center;
}
.stat b { display: block; font-size: 22px; font-weight: 800; line-height: 1.2; }
.stat b small { font-size: 13px; font-weight: 700; margin-left: 1px; }
.stat span { font-size: 11px; opacity: 0.88; }
.toc {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 16px 18px;
  margin-bottom: 20px;
}
.toc h2 { margin: 0 0 8px; font-size: 13px; color: var(--dim); letter-spacing: 0.06em; }
.toc ol { margin: 0; padding: 0; list-style: none; }
.toc li + li { border-top: 1px dashed var(--line); }
.toc a {
  display: flex; align-items: baseline; gap: 10px;
  padding: 7px 0; color: inherit; text-decoration: none; font-size: 13.5px;
}
.toc-no { color: var(--accent); font-weight: 800; font-variant-numeric: tabular-nums; }
.toc-text { flex: 1; }
.toc-wrong {
  flex: 0 0 auto; font-size: 11px; font-weight: 700;
  color: var(--ng); background: var(--ng-bg); border-radius: 999px; padding: 1px 8px;
}
.q {
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 5px solid var(--accent);
  border-radius: 18px;
  padding: 18px 20px;
  margin-bottom: 16px;
}
.q-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.no {
  font-size: 20px; font-weight: 800; color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.badges { display: flex; flex-wrap: wrap; gap: 6px; }
.badge {
  font-size: 11px; font-weight: 700; color: var(--dim);
  background: color-mix(in srgb, var(--line) 60%, transparent);
  border-radius: 999px; padding: 2px 9px; white-space: nowrap;
}
.badge.warn { color: #fff; background: var(--ng); }
.badge.cat { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.stem { margin: 6px 0 14px; font-size: 16px; font-weight: 600; }
.choices { list-style: none; margin: 0 0 14px; padding: 0; }
.choice {
  display: flex; align-items: flex-start; gap: 10px;
  border: 1px solid var(--line); border-radius: 13px;
  padding: 10px 12px; margin-bottom: 7px; font-size: 14.5px;
}
.choice .mark {
  flex: 0 0 auto; width: 24px; height: 24px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12.5px; font-weight: 800;
  background: color-mix(in srgb, var(--line) 70%, transparent); color: var(--dim);
}
.choice .ctext { flex: 1; }
.choice.ok { border-color: var(--ok); background: var(--ok-bg); }
.choice.ok .mark { background: var(--ok); color: #fff; }
.choice.mine { border-color: var(--ng); background: var(--ng-bg); }
.choice.mine .mark { background: var(--ng); color: #fff; }
.tag {
  flex: 0 0 auto; font-size: 11px; font-weight: 800; border-radius: 999px; padding: 1px 9px;
  align-self: center;
}
.tag.ok { color: #fff; background: var(--ok); }
.tag.ng { color: #fff; background: var(--ng); }
.answer-only {
  margin: 0 0 14px; padding: 10px 12px; border-radius: 13px;
  background: var(--ok-bg); border: 1px solid var(--ok); font-size: 14.5px;
}
.answer-only b { color: var(--ok); margin-right: 8px; }
.why { border-radius: 13px; padding: 12px 14px; margin-bottom: 10px; font-size: 14px; }
.why h3 { margin: 0 0 6px; font-size: 12px; letter-spacing: 0.04em; }
.why p { margin: 0; }
.why.ok { background: var(--ok-bg); }
.why.ok h3 { color: var(--ok); }
.why.ng { background: color-mix(in srgb, var(--line) 42%, transparent); }
.why.ng h3 { color: var(--dim); }
.why.ng ul { margin: 0; padding-left: 0; list-style: none; }
.why.ng li { padding: 3px 0; }
.why.ng li + li { border-top: 1px dashed var(--line); }
.why.ng li b {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 6px; margin-right: 8px;
  background: var(--ng); color: #fff; font-size: 11px;
}
.why.ng li.mine { font-weight: 700; }
.memo {
  border-top: 1px dashed var(--line); padding-top: 10px; font-size: 13.5px; color: var(--dim);
}
.memo p { margin: 4px 0; }
.memo b { color: var(--text); margin-right: 8px; }
.empty {
  background: var(--surface); border: 1px solid var(--line); border-radius: 18px;
  padding: 24px; text-align: center; color: var(--dim); font-size: 14px;
}
footer { margin-top: 26px; text-align: center; font-size: 11.5px; color: var(--dim); line-height: 1.8; }

@media print {
  body { background: #fff; }
  .wrap { max-width: none; padding: 0; }
  .hero {
    background: #fff; color: #111; border: 2px solid var(--accent);
    border-radius: 0; padding: 14px 16px;
  }
  .kicker, .scope { color: #555; }
  .stat { background: #f2f4f8; color: #111; }
  .wrap.long .toc { page-break-after: always; }
  .q { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
  a { color: inherit; text-decoration: none; }
}
@page { margin: 14mm; }
`
