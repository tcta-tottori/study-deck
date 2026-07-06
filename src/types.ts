export type Category =
  | '共通_品質管理'
  | '共通_原価管理'
  | '共通_納期管理'
  | '共通_安全衛生管理'
  | '共通_環境管理'
  | 'PLN_生産システム設計'
  | 'PLN_工場計画レイアウト'
  | 'PLN_生産方式'
  | 'PLN_製品開発設計'
  | 'PLN_需要予測生産計画'
  | 'PLN_在庫資材管理'
  | 'PLN_購買外注管理'
  | 'PLN_IE作業研究'
  | 'PLN_設備管理保全'

export const CATEGORIES: Category[] = [
  '共通_品質管理',
  '共通_原価管理',
  '共通_納期管理',
  '共通_安全衛生管理',
  '共通_環境管理',
  'PLN_生産システム設計',
  'PLN_工場計画レイアウト',
  'PLN_生産方式',
  'PLN_製品開発設計',
  'PLN_需要予測生産計画',
  'PLN_在庫資材管理',
  'PLN_購買外注管理',
  'PLN_IE作業研究',
  'PLN_設備管理保全',
]

/** 表示用のカテゴリ短縮名（アンダースコアの後ろだけ） */
export function categoryLabel(c: Category): string {
  const i = c.indexOf('_')
  return i >= 0 ? c.slice(i + 1) : c
}

export type AnswerIndex = 0 | 1 | 2 | 3

export interface Question {
  id: string // "OFF-R06A-0001" / "ORIG-0001" など
  origin: 'official' | 'original'
  category: Category
  subcategory?: string
  stem: string
  choices: [string, string, string, string]
  answerIndex: AnswerIndex
  explanation: string
  source?: string
  /** ユーザーが後から手入力/AI生成した補足解説（seedは上書きしない） */
  aiExplanation?: string
  /** 誤答ノート（自由記述メモ） */
  note?: string
}

export type Box = 1 | 2 | 3 | 4 | 5

export interface StudyRecord {
  questionId: string
  box: Box
  dueAt: number // 次に出す予定時刻 epoch ms
  lastAnswered: number
  correctCount: number
  wrongCount: number
  /** 直近で選んだ誤答の選択肢インデックス（復習用） */
  lastWrongChoice?: AnswerIndex
}

/** 本番シミュレーションの結果履歴 */
export interface ExamResult {
  id?: number
  takenAt: number
  total: number // 出題数（通常40）
  correct: number
  score: number // 100点満点換算
  passed: boolean
  durationSec: number
  /** カテゴリ別の {正解, 出題} */
  byCategory: Record<string, { correct: number; total: number }>
  /** 出題した問題ID（見直し用） */
  questionIds: string[]
  /** 各問の回答（-1 = 未回答） */
  answers: number[]
}

export interface AppSettings {
  key: 'app'
  dailyGoal: number
  interleave: boolean
  examDurationSec: number
  examDate: string // 試験日 "YYYY-MM-DD"（ホームのカウントダウン用）
  landscape: boolean // 横画面モード（UIを回転して強制横表示。自動回転ではない）
  reminderTime?: string // "HH:MM" ローカル通知
  theme: 'auto' | 'light' | 'dark'
  anthropicApiKey?: string // 端末ローカル保存・非コミット
  seedVersion?: number
}
