/**
 * 問題図（SVG）の無害化。
 * 取込JSONに含まれるSVGをそのまま innerHTML に入れるのは危険なので、
 * script／foreignObject／イベント属性／外部参照を取り除いた <svg> だけを返す。
 * 不正なSVGなら null。
 */
const BANNED_TAGS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'style', 'image', 'use'])

export function sanitizeSvg(src: string | undefined): string | null {
  if (!src || typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(src.trim(), 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length)
    return null
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (BANNED_TAGS.has(child.nodeName.toLowerCase())) child.remove()
      else walk(child)
    }
    for (const attr of Array.from(el.attributes)) {
      const n = attr.name.toLowerCase()
      const v = attr.value.trim().toLowerCase()
      if (n.startsWith('on') || ((n === 'href' || n === 'xlink:href') && !v.startsWith('#')) || v.includes('javascript:'))
        el.removeAttribute(attr.name)
    }
  }
  walk(root)
  // 幅は親に合わせて伸縮させる（viewBox 必須）
  root.removeAttribute('width')
  root.removeAttribute('height')
  root.setAttribute('role', 'img')
  return new XMLSerializer().serializeToString(root)
}

/** 取込時の簡易チェック（<svg …> で始まり viewBox を持つか） */
export function looksLikeSvg(v: unknown): v is string {
  return typeof v === 'string' && /^\s*<svg[\s>]/i.test(v) && /viewBox=/i.test(v)
}
