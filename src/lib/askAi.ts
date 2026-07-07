import type { Question } from '../types'

const LETTERS = ['ア', 'イ', 'ウ', 'エ']

/** 問題・選択肢・正解から、AIに詳しい解説を求めるプロンプトを組み立てる */
export function buildAiPrompt(q: Question): string {
  const choices = q.choices.map((c, i) => `${LETTERS[i]}. ${c}`).join('\n')
  const answer = `${LETTERS[q.answerIndex]}. ${q.choices[q.answerIndex]}`
  const ref = q.explanation ? `\n\n【参考解説】\n${q.explanation}` : ''
  return `あなたは「生産管理プランニング3級（ビジネス・キャリア検定）」の講師です。次の問題について、初学者にもわかるように日本語で詳しく解説してください。
・正解が正しい理由を根拠とともに説明
・ほかの選択肢がなぜ誤りなのかを一つずつ説明
・関連する重要用語や覚えておくべきポイントを補足

【問題】
${q.stem}

【選択肢】
${choices}

【正解】
${answer}${ref}`
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
