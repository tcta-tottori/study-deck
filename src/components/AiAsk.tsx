import type { Question } from '../types'
import { Icon } from './Icon'
import { BrandIcon } from './BrandIcon'
import { useToast } from './Toast'
import { buildAiPrompt, aiServiceUrl, copyText, AI_SERVICES, type AiService } from '../lib/askAi'

/**
 * 「AIに詳しく聞く」ボタン群（Claude / ChatGPT ＋ コピー）。
 * クイズの解説と試験結果の見直しで共用する。
 * プロンプトは必ずクリップボードへコピーし、自動入力されない場合も貼り付けられるようにする。
 */
export function AiAsk({
  question,
  selectedIndex,
  compact = false,
}: {
  question: Question
  /** 自分が選択した解答（未回答は -1）。プロンプトに「私の解答」として含める。 */
  selectedIndex?: number | null
  compact?: boolean
}) {
  const toast = useToast()

  function askAi(service: AiService) {
    const prompt = buildAiPrompt(question, selectedIndex)
    const url = aiServiceUrl(service, prompt)
    // Claude / ChatGPT はURLに載せて自動入力される。コピーは貼り付け用の保険。
    void copyText(prompt)
    window.open(url, '_blank', 'noopener,noreferrer')
    toast('プロンプトをコピーしました。開いたチャット欄に貼り付けても質問できます。')
  }

  async function copyAiPrompt() {
    const ok = await copyText(buildAiPrompt(question, selectedIndex))
    toast(ok ? 'プロンプトをコピーしました。AIアプリに貼り付けてください。' : 'コピーに失敗しました')
  }

  return (
    <div className={`ai-ask${compact ? ' compact' : ''}`}>
      <div className="ai-ask-head">
        <Icon name="sparkle" size={15} />
        AIに詳しく聞く
      </div>
      <div className="ai-ask-btns">
        {AI_SERVICES.map((s) => (
          <button key={s.key} className={`ai-chip brand-${s.key}`} onClick={() => askAi(s.key)}>
            <BrandIcon name={s.key} size={16} />
            {s.label}
          </button>
        ))}
        <button className="ai-chip ghost" onClick={copyAiPrompt} aria-label="プロンプトをコピー">
          <Icon name="copy" size={15} /> コピー
        </button>
      </div>
    </div>
  )
}
