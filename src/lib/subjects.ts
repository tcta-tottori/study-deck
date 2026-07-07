// 学習科目（試験）の定義。
// いまは1科目のみだが、将来ここに追加すればホーム上部・設定の科目切替に自動で並ぶ。
// （問題データを科目で分けるようになったら、buildQueue/stats 側で subjectId 絞り込みを追加する）

export interface Subject {
  id: string
  /** 正式名（ホーム上部・設定に表示） */
  name: string
  /** 短縮名（任意・狭い場所用） */
  short?: string
}

export const SUBJECTS: Subject[] = [
  { id: 'seisan-kanri-planning-3', name: '生産管理プランニング3級', short: '生産管理3級' },
]

export const DEFAULT_SUBJECT_ID = SUBJECTS[0].id

/** id から科目を取得（未知/未設定は先頭科目にフォールバック） */
export function getSubject(id: string | undefined): Subject {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0]
}
