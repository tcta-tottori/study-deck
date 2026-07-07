import type { Question } from '../types'

const LETTERS = ['ア', 'イ', 'ウ', 'エ']

/**
 * 問題・選択肢・正解から、AIに詳しい解説を求めるプロンプトを組み立てる。
 * selectedIndex を渡すと「私の解答」を含め、誤答時はその選択肢の誤りを
 * 重点的に解説するよう依頼する（未回答は -1）。
 */
export function buildAiPrompt(q: Question, selectedIndex?: number | null): string {
  const choices = q.choices.map((c, i) => `${LETTERS[i]}. ${c}`).join('\n')
  const answer = `${LETTERS[q.answerIndex]}. ${q.choices[q.answerIndex]}`
  const ref = q.explanation ? `\n\n【参考解説】\n${q.explanation}` : ''

  // 自分が選択した解答（未回答や範囲外は「未回答」扱い）
  const picked =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < q.choices.length
      ? selectedIndex
      : null
  const wrong = picked != null && picked !== q.answerIndex
  const mineBlock =
    picked != null
      ? `\n\n【私の解答】\n${LETTERS[picked]}. ${q.choices[picked]}（${wrong ? '不正解' : '正解'}）`
      : selectedIndex === -1
        ? `\n\n【私の解答】\n未回答`
        : ''
  // 誤答時は、自分が選んだ選択肢がなぜ誤りかを重点的に説明してもらう
  const wrongLine = wrong
    ? `\n・特に、私が選んだ「${LETTERS[picked]}」がなぜ誤りなのかを重点的に説明`
    : ''

  return `あなたは「生産管理プランニング3級（ビジネス・キャリア検定）」の講師です。次の問題について、初学者にもわかるように日本語で詳しく解説してください。
・正解が正しい理由を根拠とともに説明
・ほかの選択肢がなぜ誤りなのかを一つずつ説明${wrongLine}
・関連する重要用語や覚えておくべきポイントを補足

【問題】
${q.stem}

【選択肢】
${choices}

【正解】
${answer}${mineBlock}${ref}`
}

export type AiService = 'claude' | 'chatgpt'

export const AI_SERVICES: { key: AiService; label: string }[] = [
  { key: 'claude', label: 'Claude' },
  { key: 'chatgpt', label: 'ChatGPT' },
]

/**
 * 各サービスを開くURL。
 * Claude / ChatGPT はクエリでチャット欄へ自動入力（プレフィル）できる。
 * https URL なので、アプリがインストールされていれば OS のユニバーサルリンクで
 * 該当アプリが開き、無ければブラウザで開く。
 */
export function aiServiceUrl(service: AiService, prompt: string): string {
  const q = encodeURIComponent(prompt)
  switch (service) {
    case 'claude':
      return `https://claude.ai/new?q=${q}`
    case 'chatgpt':
      return `https://chatgpt.com/?q=${q}`
  }
}

/** クリップボードへコピー（Clipboard API 不可時は execCommand にフォールバック） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* フォールバックへ */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
