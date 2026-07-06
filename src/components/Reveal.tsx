import { cloneElement, isValidElement, useEffect, useRef, type ReactElement } from 'react'

/**
 * 子要素をビューポート進入時に「下から浮かび上がる」演出でリビールする。
 * 追加のラッパー要素を挟まず、子要素へ .reveal / .reveal-in クラスを付与する。
 * リビール内のゲージ（.bar-fill 等）は 0 の状態から表示に合わせて伸びる（styles.css）。
 */
export default function Reveal({ children }: { children: ReactElement }) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const show = () => el.classList.add('reveal-in')

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') {
      show()
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            show()
            io.disconnect()
            break
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!isValidElement(children)) return children
  const child = children as ReactElement<{ className?: string }>
  const merged = child.props.className ? `reveal ${child.props.className}` : 'reveal'
  // ref と className をマージして差し込む（ラッパー要素を増やさない）
  return cloneElement(child, { ref, className: merged } as Record<string, unknown>)
}
