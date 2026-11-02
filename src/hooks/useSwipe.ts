import { useLayoutEffect, useRef } from 'react'

/**
 * A sideways swipe, read from pointer events: a quick, mostly horizontal
 * flick. Vertical movement is left to native scrolling (pair the element
 * with touch-action: pan-y), so lists still scroll with a finger.
 */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null)
  const latest = useRef({ onLeft, onRight })
  useLayoutEffect(() => {
    latest.current = { onLeft, onRight }
  })
  return {
    onPointerDown(e: React.PointerEvent) {
      if ((e.target as HTMLElement).closest('input, select, textarea, [data-noswipe]')) return
      start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }
    },
    onPointerUp(e: React.PointerEvent) {
      const s = start.current
      start.current = null
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      const fast = Math.abs(dx) / Math.max(1, e.timeStamp - s.t) > 0.35
      if (Math.abs(dx) < (fast ? 40 : 70) || Math.abs(dx) < Math.abs(dy) * 1.6) return
      if (dx < 0) latest.current.onLeft()
      else latest.current.onRight()
    },
    onPointerCancel() {
      start.current = null
    },
  }
}

/** Tabs you can swipe between: left for the next one, right for the previous. */
export function useSwipeTabs<T extends string>(tabs: readonly T[], current: T, set: (t: T) => void) {
  const i = tabs.indexOf(current)
  return useSwipe(
    () => i < tabs.length - 1 && set(tabs[i + 1]),
    () => i > 0 && set(tabs[i - 1]),
  )
}
