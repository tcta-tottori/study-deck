// JAVADA「生産管理プランニング」試験範囲の7分類
export type Category =
  | '製品企画・設計管理'
  | '生産システム・生産計画'
  | '品質管理'
  | '原価管理'
  | '納期管理'
  | '安全衛生管理'
  | '環境管理'

export const CATEGORIES: Category[] = [
  '製品企画・設計管理',
  '生産システム・生産計画',
  '品質管理',
  '原価管理',
  '納期管理',
  '安全衛生管理',
  '環境管理',
]

/** 表示用のカテゴリ名（7分類はそのまま表示） */
export function categoryLabel(c: Category): string {
  return c
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
  /** 学習中の科目（試験）ID。lib/subjects.ts の SUBJECTS を参照 */
  subjectId?: string
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
