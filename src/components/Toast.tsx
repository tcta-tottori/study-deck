import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export const ToastCtx = createContext<(msg: ReactNode) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function useToastState() {
  const [node, setNode] = useState<ReactNode | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((msg: ReactNode) => {
    setNode(msg)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setNode(null), 1800)
  }, [])
  return { node, show }
}

export default function Toast({ children }: { children: ReactNode }) {
  return <div className="toast">{children}</div>
}
