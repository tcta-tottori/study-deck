import type { AnswerMode, Question } from '../types'

const LETTERS = ['ア', 'イ', 'ウ', 'エ']

/** 理由文の先頭に付いた ○/×/・ 等の記号を落とす（○×はこちらで正解に基づき付与するため）。 */
function stripMark(s: string): string {
  return s.replace(/^\s*[○◯✓〇×✕✗＊*・\-—–\s]+/, '').trim()
}

/**
 * 解答後に「各選択肢がなぜ正解／不正解か」を○×付きで一覧表示する。
 * question.choiceReasons（文字列4つ）がある問題でのみ描画。無ければ null。
 * ○×は選択肢の並び順（ア〜エ）と answerIndex から確定的に決める（理由文の記号には依存しない）。
 *
 * mode='detailed'（既定）: 全4選択肢を選択肢文＋理由つきで表示。
 * mode='simple': 不正解の選択肢だけを「記号＋理由」の簡潔表示にする（選択肢文は省く）。
 */
export function ChoiceReasons({
  question,
  chosen,
  mode = 'detailed',
}: {
  question: Question
  /** 自分が選んだ選択肢（未回答は null/undefined）。誤って選んだ肢を強調する。 */
  chosen?: number | null
  mode?: AnswerMode
}) {
  const reasons = question.choiceReasons
  if (!reasons || reasons.length !== 4) return null

  if (mode === 'simple') {
    // 不正解の選択肢のみ、選択肢文を省いて「記号＋理由」だけを簡潔に並べる。
    const others = question.choices
      .map((_, i) => i)
      .filter((i) => i !== question.answerIndex)
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
