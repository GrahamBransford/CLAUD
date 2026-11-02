import { useLayoutEffect, useRef } from 'react'
import { tick } from './haptics'

/**
 * Pinch a video to float it out of the feed, like YouTube. Two fingers
 * moving together (or a trackpad pinch on a laptop) fire once per gesture.
 * While two fingers are down, swipes elsewhere stand aside.
 */
let fingers = 0
let quietUntil = 0
export const isPinching = () => fingers > 1 || performance.now() < quietUntil

export function usePinch(onPinch: () => void) {
  const g = useRef<{ d: number; fired: boolean } | null>(null)
  const cb = useRef(onPinch)
  const wheelAt = useRef(0)
  useLayoutEffect(() => {
    cb.current = onPinch
  })
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const fire = () => {
    tick('firm')
    cb.current()
  }
  return {
    onTouchStart(e: React.TouchEvent) {
      fingers = e.touches.length
      if (e.touches.length === 2) g.current = { d: dist(e.touches), fired: false }
    },
    onTouchMove(e: React.TouchEvent) {
      const s = g.current
      if (!s || e.touches.length < 2 || s.fired) return
      if (dist(e.touches) < s.d * 0.72) {
        s.fired = true
        fire()
      }
    },
    onTouchEnd(e: React.TouchEvent) {
      fingers = e.touches.length
      if (e.touches.length < 2 && g.current) {
        g.current = null
        quietUntil = performance.now() + 400
      }
    },
    onWheel(e: React.WheelEvent) {
      // a trackpad pinch arrives as a wheel event with ctrlKey
      if (!e.ctrlKey || e.deltaY < 3) return
      const now = performance.now()
      if (now - wheelAt.current < 800) return
      wheelAt.current = now
      fire()
    },
  }
}
