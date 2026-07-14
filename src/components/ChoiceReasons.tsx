import type { Question } from '../types'

const LETTERS = ['ア', 'イ', 'ウ', 'エ']

/** 理由文の先頭に付いた ○/×/・ 等の記号を落とす（×はこちらで付与するため）。 */
function stripMark(s: string): string {
  return s.replace(/^\s*[○◯✓〇×✕✗＊*・\-—–\s]+/, '').trim()
}

/**
 * 解答後に「不正解の選択肢がなぜ違うのか」を記号＋理由だけで簡潔に表示する。
 * question.choiceReasons（文字列4つ）がある問題でのみ描画。無ければ null。
 * 選択肢文は省き（上の選択肢ボタンで確認できる）、記号は answerIndex から確定的に決める。
 */
export function ChoiceReasons({
  question,
  chosen,
}: {
  question: Question
  /** 自分が選んだ選択肢（未回答は null/undefined）。誤って選んだ肢を強調する。 */
  chosen?: number | null
}) {
  const reasons = question.choiceReasons
  if (!reasons || reasons.length !== 4) return null

  const others = question.choices.map((_, i) => i).filter((i) => i !== question.answerIndex)
  return (
    <div className="choice-reasons simple">
      <div className="cr-title">他の選択肢が違う理由</div>
      <ul className="cr-list">
        {others.map((i) => (
          <li key={i} className={`cr-row cr-wrong cr-compact${chosen === i ? ' cr-mine' : ''}`}>
            <span className="cr-badge ng" aria-hidden>
              ×
            </span>
            <div className="cr-reason">
              <span className="cr-letter">{LETTERS[i]}．</span>
              {stripMark(reasons[i])}
              {chosen === i && <span className="cr-mine-tag">あなたの解答</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
