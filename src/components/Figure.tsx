import { useMemo } from 'react'
import { sanitizeSvg } from '../lib/figure'

/** 問題図（SVG）を表示する。無害化に失敗したら何も出さない。 */
export function Figure({ svg }: { svg?: string }) {
  const safe = useMemo(() => sanitizeSvg(svg), [svg])
  if (!safe) return null
  return <figure className="q-figure" dangerouslySetInnerHTML={{ __html: safe }} />
}
