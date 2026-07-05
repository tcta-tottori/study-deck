import type { Question } from '../types'

/**
 * Anthropic API で解説を生成する。
 * - APIキーは端末ローカル（settings）に保存され、公開コードには含めない。
 * - キー未設定時は呼び出さない（UI側でボタンを隠す）。
 * 注: ブラウザから直接呼ぶため anthropic-dangerous-direct-browser-access を付与。
 *     これは各自のキーを各自の端末で使う個人利用を前提とした割り切り。
 */
export async function generateExplanation(q: Question, apiKey: string): Promise<string> {
  const choices = q.choices.map((c, i) => `${'アイウエ'[i]}. ${c}`).join('\n')
  const prompt = `あなたは生産管理の講師です。次の4択問題について、日本語で簡潔（200字程度）に解説してください。なぜ正解が正しく、主要な誤答がなぜ誤りかに触れてください。

問題: ${q.stem}
${choices}
正解: ${'アイウエ'[q.answerIndex]}

解説:`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`APIエラー ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const text: string = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
    .trim()
  if (!text) throw new Error('空の応答')
  return text
}
