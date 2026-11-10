import { CATEGORIES, type Category } from '../types'
import { DEFAULT_SUBJECT_ID, categoryColorOf, getSubject } from './subjects'

/**
 * 旧14分類 → 新7分類（JAVADA プランニング試験範囲）への対応。
 * 既存の取込済みデータや旧CSV/JSONを新分類へ寄せるために使う。
 */
const OLD_TO_NEW: Record<string, Category> = {
  共通_品質管理: '品質管理',
  共通_原価管理: '原価管理',
  共通_納期管理: '納期管理',
  共通_安全衛生管理: '安全衛生管理',
  共通_環境管理: '環境管理',
  PLN_製品開発設計: '製品企画・設計管理',
  PLN_生産システム設計: '生産システム・生産計画',
  PLN_工場計画レイアウト: '生産システム・生産計画',
  PLN_生産方式: '生産システム・生産計画',
  PLN_需要予測生産計画: '生産システム・生産計画',
  PLN_在庫資材管理: '生産システム・生産計画',
  PLN_購買外注管理: '生産システム・生産計画',
  PLN_IE作業研究: '生産システム・生産計画',
  PLN_設備管理保全: '生産システム・生産計画',
}

const NEW_SET = new Set<string>(CATEGORIES)

/** カテゴリごとの識別カラー（ホーム・勉強中で共通）。科目ごとの定義は lib/subjects.ts。 */
export function categoryColor(c: Category): string {
  return categoryColorOf(c)
}

/**
 * 与えられたカテゴリ文字列を、指定科目の分類へ正規化。対応がなければ null。
 * 生産管理プランニング3級では旧14分類も新7分類へ自動変換する。
 */
export function normalizeCategory(value: string, subjectId?: string): Category | null {
  const subject = getSubject(subjectId)
  if (subject.categories.includes(value)) return value
  if (subject.id === DEFAULT_SUBJECT_ID) {
    if (NEW_SET.has(value)) return value
    if (value in OLD_TO_NEW) return OLD_TO_NEW[value]
  }
  return null
}
