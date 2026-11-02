import { useEffect, useLayoutEffect, useRef } from 'react'
import { useUI } from '../store/useUI'

/** Keyboard shortcuts for the active station; ignored while typing or when a sheet is open. */
export function useKeys(enabled: boolean, map: Record<string, () => void>) {
  const ref = useRef(map)
  useLayoutEffect(() => {
    ref.current = map
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [role="slider"]') || e.metaKey || e.ctrlKey || e.altKey) return
      const ui = useUI.getState()
      if (ui.sheet || ui.fullEpisode || ui.drive) return
      const fn = ref.current[e.key] ?? ref.current[e.key.toLowerCase()]
      if (!fn) return
      if (e.key === ' ' && t.closest('button')) return
      e.preventDefault()
      fn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
