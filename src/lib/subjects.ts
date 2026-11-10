// 学習科目（試験）の定義。
// ここに追加すればホーム上部・設定の科目切替に自動で並ぶ。
// 問題は Question.subjectId で科目に属する（未設定＝先頭の生産管理プランニング3級）。
// 出題・成績・まとめノート・音声復習などは「いま選んでいる科目」の問題だけを対象にする。

import type { Question } from '../types'

export interface Subject {
  id: string
  /** 正式名（ホーム上部・設定に表示） */
  name: string
  /** 短縮名（任意・狭い場所用） */
  short?: string
  /** 出題範囲の分類（表示順）。問題の category はこのどれか */
  categories: string[]
  /** 分類ごとの識別カラー（categories と同じ順） */
  colors: string[]
}

// 識別カラーの共通パレット（白基調で読める彩度）
const PALETTE = ['#7c5ce0', '#2f6fe0', '#159f8a', '#d9982f', '#e0554e', '#e07b2f', '#3aa564', '#c0499b']

export const SUBJECTS: Subject[] = [
  {
    id: 'seisan-kanri-planning-3',
    name: '生産管理プランニング3級',
    short: '生産管理3級',
    // JAVADA「生産管理プランニング」試験範囲の7分類
    categories: [
      '製品企画・設計管理',
      '生産システム・生産計画',
      '品質管理',
      '原価管理',
      '納期管理',
      '安全衛生管理',
      '環境管理',
    ],
    colors: PALETTE.slice(0, 7),
  },
  {
    id: 'eigyo-3',
    name: '営業3級',
    short: '営業3級',
    categories: [
      '営業パーソンの役割・心構え',
      '営業計画・目標管理',
      '営業事務・営業情報',
      '計数管理',
      '営業活動の実践',
      '組織的営業・営業戦略',
      '与信管理・取引法務',
    ],
    colors: PALETTE.slice(0, 7),
  },
  {
    id: 'marketing-3',
    name: 'マーケティング3級',
    short: 'マーケ3級',
    categories: [
      'マーケティングの基礎概念',
      '環境分析・マーケティング戦略',
      'マーケティング・リサーチ',
      '消費者行動',
      '製品・価格政策',
      'チャネル・物流政策',
      'プロモーション政策',
      '流通・小売・サービス',
    ],
    colors: PALETTE.slice(0, 8),
  },
]

export const DEFAULT_SUBJECT_ID = SUBJECTS[0].id

/** id から科目を取得（未知/未設定は先頭科目にフォールバック） */
export function getSubject(id: string | undefined): Subject {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0]
}

/** 既知の科目IDか */
export function isSubjectId(id: unknown): id is string {
  return typeof id === 'string' && SUBJECTS.some((s) => s.id === id)
}

/** 問題が属する科目ID（未設定は先頭科目） */
export function subjectIdOf(q: Pick<Question, 'subjectId'>): string {
  return isSubjectId(q.subjectId) ? q.subjectId : DEFAULT_SUBJECT_ID
}

/** 指定科目の問題だけに絞る */
export function filterBySubject<T extends Pick<Question, 'subjectId'>>(qs: T[], subjectId: string | undefined): T[] {
  const sid = getSubject(subjectId).id
  return qs.filter((q) => subjectIdOf(q) === sid)
}

/** 分類名 → 識別カラー（全科目ぶん。分類名は科目間で重複しない） */
const COLOR_BY_CATEGORY = new Map<string, string>()
for (const s of SUBJECTS) s.categories.forEach((c, i) => COLOR_BY_CATEGORY.set(c, s.colors[i] ?? PALETTE[0]))

export function categoryColorOf(c: string): string {
  return COLOR_BY_CATEGORY.get(c) ?? '#2f6fe0'
}

/** 問題群（同一科目）の分類一覧（科目の定義順＋定義外の分類を末尾に） */
export function categoriesFor(questions: Pick<Question, 'subjectId' | 'category'>[]): string[] {
  const order = questions.length ? [...getSubject(subjectIdOf(questions[0])).categories] : []
  for (const q of questions) if (!order.includes(q.category)) order.push(q.category)
  return order
}
