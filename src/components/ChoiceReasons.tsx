import type { Question } from '../types'

const LETTERS = ['ア', 'イ', 'ウ', 'エ']

/** 理由文の先頭に付いた ○/×/・ 等の記号を落とす（○×はこちらで正解に基づき付与するため）。 */
function stripMark(s: string): string {
  return s.replace(/^\s*[○◯✓〇×✕✗＊*・\-—–\s]+/, '').trim()
}

/**
 * 解答後に「各選択肢がなぜ正解／不正解か」を○×付きで一覧表示する。
 * question.choiceReasons（文字列4つ）がある問題でのみ描画。無ければ null。
 * ○×は選択肢の並び順（ア〜エ）と answerIndex から確定的に決める（理由文の記号には依存しない）。
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
  return (
    <div className="choice-reasons">
      <div className="cr-title">選択肢ごとの理由</div>
      <ul className="cr-list">
        {question.choices.map((c, i) => {
          const isCorrect = i === question.answerIndex
          const isMineWrong = chosen === i && !isCorrect
          return (
            <li
              key={i}
              className={`cr-row ${isCorrect ? 'cr-correct' : 'cr-wrong'}${isMineWrong ? ' cr-mine' : ''}`}
            >
              <span className={`cr-badge ${isCorrect ? 'ok' : 'ng'}`} aria-hidden>
                {isCorrect ? '○' : '×'}
              </span>
              <div className="cr-body">
                <div className="cr-choice">
                  <span className="cr-letter">{LETTERS[i]}．</span>
                  {c}
                  {isMineWrong && <span className="cr-mine-tag">あなたの解答</span>}
                </div>
                <div className="cr-reason">{stripMark(reasons[i])}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
