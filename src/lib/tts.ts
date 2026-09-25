/**
 * 端末内蔵の音声合成（Web Speech API / SpeechSynthesis）ラッパー。
 *
 * 方針:
 * - 外部APIもネットワークも使わない。OS/ブラウザ同梱の音声エンジンで読み上げるため
 *   無料・オフライン・APIキー不要（iOS Safari=Kyoko等、Android Chrome=Google日本語音声）。
 * - 長文を一度に speak するとブラウザ側で途中停止する既知の不具合があるため、
 *   文単位の短いセグメントに割って順に読み上げる。
 * - onend が来ない環境向けにウォッチドッグ（推定所要時間＋猶予で強制的に次へ）を持つ。
 */

export function ttsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
  )
}

/**
 * 利用可能な音声一覧を取得する。
 * Chrome系は初回 getVoices() が空配列を返し voiceschanged で後から届くため、
 * イベント待ち＋ポーリングの二段構えで待つ（最大 timeoutMs）。
 */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([])
  const synth = window.speechSynthesis
  const initial = synth.getVoices()
  if (initial.length > 0) return Promise.resolve(initial)

  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      synth.removeEventListener('voiceschanged', onChanged)
      clearInterval(poll)
      clearTimeout(timer)
      resolve(synth.getVoices())
    }
    const onChanged = () => {
      if (synth.getVoices().length > 0) finish()
    }
    synth.addEventListener('voiceschanged', onChanged)
    const poll = setInterval(onChanged, 200)
    const timer = setTimeout(finish, timeoutMs)
  })
}

/** 日本語の音声だけを抽出（ローカル音声＝オフライン可を先頭に） */
export function japaneseVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices
    .filter((v) => v.lang?.toLowerCase().startsWith('ja'))
    .sort((a, b) => {
      if (a.localService !== b.localService) return a.localService ? -1 : 1
      if (a.default !== b.default) return a.default ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

/** 設定の音声名（あれば）を優先しつつ、日本語音声を1つ選ぶ */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredName?: string,
): SpeechSynthesisVoice | null {
  const ja = japaneseVoices(voices)
  if (preferredName) {
    const hit = voices.find((v) => v.name === preferredName)
    if (hit) return hit
  }
  return ja[0] ?? null
}

/** 読み上げ用にテキストを整える（記号を読める語へ・不要な装飾を除去） */
export function speakable(raw: string): string {
  return (
    raw
      .replace(/\r/g, '')
      .replace(/[*#`]/g, '')
      // 単位・記号を読み上げやすい語に置換
      .replace(/％|%/g, 'パーセント')
      .replace(/[〜~～]/g, 'から')
      .replace(/[→⇒]/g, '、')
      .replace(/≒/g, 'およそ')
      .replace(/≦|＜=/g, '以下')
      .replace(/≧|＞=/g, '以上')
      .replace(/±/g, 'プラスマイナス')
      .replace(/[／/]/g, '、')
      .replace(/[（(]\s*[)）]/g, '')
      .replace(/\n+/g, '、')
      .replace(/[ \t　]+/g, ' ')
      .replace(/、{2,}/g, '、')
      .trim()
  )
}

/**
 * 読み上げ単位に分割する。句点・読点・改行で切り、上限文字数を超えないようにまとめ直す。
 * 1セグメントを短く保つことで、ブラウザ側の「長文で途中停止する」不具合を避ける。
 */
export function splitForSpeech(text: string, max = 60): string[] {
  const src = speakable(text)
  if (!src) return []
  // 句点（。！？）で切る。長すぎるものは読点でさらに割る。
  const sentences = src
    .split(/(?<=[。！？!?])/)
    .flatMap((s) => (s.length > max ? s.split(/(?<=、)/) : [s]))
    .flatMap((s) => (s.length > max ? chunkFixed(s, max) : [s]))
    .map((s) => s.trim())
    .filter(Boolean)

  // 短すぎる断片は次とつなげて読み上げのリズムを保つ
  const out: string[] = []
  for (const s of sentences) {
    const last = out[out.length - 1]
    if (last && last.length + s.length <= max) out[out.length - 1] = last + s
    else out.push(s)
  }
  return out
}

function chunkFixed(s: string, max: number): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max))
  return out
}

export type TtsState = 'idle' | 'playing' | 'paused'

export interface TtsPlayerOptions {
  /** 現在読み上げているセグメント番号 */
  onIndex?: (index: number) => void
  onState?: (state: TtsState) => void
  /** 全セグメントを読み終えた */
  onDone?: () => void
  onError?: (message: string) => void
}

/**
 * セグメント配列を順に読み上げるプレイヤー。
 * 画面側は setQueue → play/pause/stop/seek を呼ぶだけでよい。
 */
export class TtsPlayer {
  private queue: string[] = []
  private index = 0
  private state: TtsState = 'idle'
  private rate = 1
  private voice: SpeechSynthesisVoice | null = null
  private watchdog: ReturnType<typeof setTimeout> | null = null
  /** stop()/seek() で自分が cancel したときの onend/onerror を無視するための世代番号 */
  private gen = 0

  constructor(private opts: TtsPlayerOptions = {}) {}

  setQueue(segments: string[]) {
    this.hardStop()
    this.queue = segments
    this.index = 0
    this.opts.onIndex?.(0)
  }

  setRate(rate: number) {
    this.rate = rate
    // 再生中なら現在のセグメントを新しい速度で読み直す（体感の反映を早くする）
    if (this.state === 'playing') this.speakFrom(this.index)
  }

  setVoice(voice: SpeechSynthesisVoice | null) {
    this.voice = voice
    if (this.state === 'playing') this.speakFrom(this.index)
  }

  getState(): TtsState {
    return this.state
  }

  getIndex(): number {
    return this.index
  }

  /** 指定位置（既定は現在位置）から再生。iOS対策でユーザー操作の中から呼ぶこと。 */
  play(from?: number) {
    if (!ttsSupported()) {
      this.opts.onError?.('この端末は音声読み上げに対応していません')
      return
    }
    if (this.queue.length === 0) return
    const start = from ?? this.index
    if (start >= this.queue.length) return
    this.speakFrom(start)
  }

  pause() {
    if (!ttsSupported() || this.state !== 'playing') return
    // pause() が効かない環境（一部Android）では cancel して現在位置で止める
    try {
      window.speechSynthesis.pause()
    } catch {
      this.hardStop()
    }
    this.clearWatchdog()
    this.setState('paused')
  }

  resume() {
    if (!ttsSupported()) return
    if (this.state !== 'paused') return
    const synth = window.speechSynthesis
    if (synth.paused && synth.speaking) {
      synth.resume()
      this.setState('playing')
      this.armWatchdog(this.queue[this.index] ?? '')
    } else {
      // pause が実質 cancel になっていた場合は現在セグメントから読み直す
      this.speakFrom(this.index)
    }
  }

  toggle() {
    if (this.state === 'playing') this.pause()
    else this.play()
  }

  /** 読み上げを止めて先頭位置は保持する */
  stop() {
    this.hardStop()
    this.setState('idle')
  }

  /** 指定セグメントへ移動（再生中なら続けて読み上げる） */
  seek(index: number, autoplay = true) {
    const i = Math.max(0, Math.min(index, this.queue.length - 1))
    const wasPlaying = this.state === 'playing'
    this.hardStop()
    this.index = i
    this.opts.onIndex?.(i)
    if (autoplay || wasPlaying) this.speakFrom(i)
    else this.setState('idle')
  }

  next() {
    if (this.index + 1 >= this.queue.length) {
      this.stop()
      this.opts.onDone?.()
      return
    }
    this.seek(this.index + 1, this.state === 'playing')
  }

  prev() {
    this.seek(Math.max(0, this.index - 1), this.state === 'playing')
  }

  /** 画面を離れるときに必ず呼ぶ（読み上げの置き去り防止） */
  dispose() {
    this.hardStop()
  }

  // --- 内部 ---

  private speakFrom(index: number) {
    if (!ttsSupported()) return
    const synth = window.speechSynthesis
    this.gen++
    const myGen = this.gen
    this.clearWatchdog()
    try {
      synth.cancel()
    } catch {
      /* 直前の読み上げが無い場合は無視 */
    }
    this.index = index
    this.opts.onIndex?.(index)

    const text = this.queue[index]
    if (!text) {
      this.setState('idle')
      this.opts.onDone?.()
      return
    }

    const u = new SpeechSynthesisUtterance(text)
    u.lang = this.voice?.lang || 'ja-JP'
    if (this.voice) u.voice = this.voice
    u.rate = this.rate
    u.pitch = 1
    u.volume = 1
    u.onend = () => {
      if (myGen !== this.gen) return // 自分で cancel した分は無視
      this.clearWatchdog()
      this.advance()
    }
    u.onerror = (e) => {
      if (myGen !== this.gen) return
      this.clearWatchdog()
      const err = (e as SpeechSynthesisErrorEvent).error
      // cancel 由来のエラーは通常動作なので黙って無視
      if (err === 'interrupted' || err === 'canceled') return
      this.setState('idle')
      this.opts.onError?.(
        err === 'synthesis-failed' || err === 'synthesis-unavailable'
          ? '読み上げできませんでした。端末の音声（読み上げ）設定をご確認ください'
          : '読み上げに失敗しました',
      )
    }

    this.setState('playing')
    // iOS/Safari は cancel 直後の speak を取りこぼすことがあるため次のタスクで実行
    setTimeout(() => {
      if (myGen !== this.gen) return
      try {
        synth.speak(u)
        this.armWatchdog(text)
      } catch {
        this.setState('idle')
        this.opts.onError?.('読み上げを開始できませんでした')
      }
    }, 0)
  }

  private advance() {
    if (this.index + 1 >= this.queue.length) {
      this.setState('idle')
      this.opts.onDone?.()
      return
    }
    this.speakFrom(this.index + 1)
  }

  /**
   * onend が届かないまま無音になる環境（Chrome系の既知バグ）への保険。
   * 推定所要時間＋猶予を過ぎても終了通知が無ければ次のセグメントへ進める。
   */
  private armWatchdog(text: string) {
    this.clearWatchdog()
    const charsPerSec = 7 * Math.max(0.5, this.rate)
    const estimateMs = (text.length / charsPerSec) * 1000 + 6000
    this.watchdog = setTimeout(() => {
      if (this.state !== 'playing') return
      const synth = window.speechSynthesis
      if (synth.speaking && !synth.paused) {
        // まだ読んでいる（推定が短すぎた）＝もう一度だけ待つ
        this.armWatchdog(text)
        return
      }
      this.advance()
    }, estimateMs)
  }

  private clearWatchdog() {
    if (this.watchdog) {
      clearTimeout(this.watchdog)
      this.watchdog = null
    }
  }

  private hardStop() {
    this.gen++
    this.clearWatchdog()
    if (!ttsSupported()) return
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* 未再生なら無視 */
    }
  }

  private setState(s: TtsState) {
    if (this.state === s) return
    this.state = s
    this.opts.onState?.(s)
  }
}
