import { motion, useMotionValue, useMotionValueEvent, useTransform, type PanInfo, type Variants } from 'framer-motion'
import { ramp, tick } from '../lib/haptics'
import { isPinching } from '../lib/pinch'
import { useRef, type ReactNode } from 'react'

/** How the current item left: judged sideways, or browsed vertically. */
export type Move = 'save' | 'skip' | 'next' | 'prev'

const EASE = [0.22, 0.7, 0.18, 1] as const
const T = { duration: 0.34, ease: EASE }

const variants: Variants = {
  initial: (m: Move) =>
    m === 'next' ? { y: '100%', opacity: 1 } : m === 'prev' ? { y: '-100%', opacity: 1 } : { scale: 0.96, opacity: 0 },
  enter: { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0, transition: T },
  exit: (m: Move) =>
    m === 'save'
      ? { x: '115%', rotate: 5, transition: T }
      : m === 'skip'
        ? { x: '-115%', rotate: -5, transition: T }
        : m === 'next'
          ? { y: '-100%', transition: T }
          : { y: '100%', transition: T },
}

interface Props {
  move: Move
  onMove: (m: Move) => void
  onTap?: () => void
  canPrev: boolean
  children: ReactNode
  className?: string
}

const X = 90
const Y = 80

/**
 * One full-screen item. Drag locks to the first direction you move in:
 * sideways judges (right = SAVE, left = SKIP), up/down browses.
 */
export function Reel({ move, onMove, onTap, canPrev, children, className }: Props) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const axis = useRef<'x' | 'y' | null>(null)
  // how far into a decision the thumb is: 0 at rest, 1 at the point where letting go commits
  const save = useTransform(x, [12, X], [0, 1], { clamp: true })
  const skip = useTransform(x, [-X, -12], [1, 0], { clamp: true })
  const tilt = useTransform(x, [-400, 400], [-3, 3])
  const saveWash = useTransform(save, [0, 1], [0, 0.72])
  const skipWash = useTransform(skip, [0, 1], [0, 0.5])
  const labelY = useTransform(x, (v) => 10 - Math.min(1, Math.abs(v) / X) * 10)
  const labelScale = useTransform(x, (v) => 0.94 + Math.min(1, Math.abs(v) / X) * 0.06)
  const committed = useRef(false)
  // the ticks quicken as the thumb travels, then land with a firm one at the commit point
  useMotionValueEvent(x, 'change', (v) => {
    if (axis.current !== 'x' || isPinching()) return
    const p = Math.abs(v) / X
    if (p >= 1 && !committed.current) {
      committed.current = true
      tick('firm')
    } else if (p < 0.92) {
      committed.current = false
      ramp(p)
    }
  })

  const end = (_: unknown, i: PanInfo) => {
    if (isPinching()) {
      axis.current = null
      return
    }
    if (axis.current === 'x') {
      // a save lands with a firmer tick than a skip
      if (i.offset.x > X || i.velocity.x > 650) {
        tick('firm')
        onMove('save')
      } else if (i.offset.x < -X || i.velocity.x < -650) {
        tick()
        onMove('skip')
      }
    } else if (axis.current === 'y') {
      if (i.offset.y < -Y || i.velocity.y < -550) {
        tick()
        onMove('next')
      } else if ((i.offset.y > Y || i.velocity.y > 550) && canPrev) {
        tick()
        onMove('prev')
      }
    }
    axis.current = null
  }

  return (
    <motion.div
      className={`reel ${className ?? ''}`}
      style={{ x, y, rotate: tilt, '--skip': skip } as never}
      drag
      dragDirectionLock
      onDirectionLock={(a) => (axis.current = a)}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={{ left: 0.9, right: 0.9, top: 0.55, bottom: canPrev ? 0.55 : 0.12 }}
      dragTransition={{ bounceStiffness: 520, bounceDamping: 42 }}
      onDragEnd={end}
      onTap={(e) => {
        // taps on the creator name or a pill are their own actions; lifting a pinch isn't a tap
        if (isPinching()) return
        if (!(e.target as Element).closest('button')) onTap?.()
      }}
      custom={move}
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      {children}
      {/* the screen itself answers: a bronze wash to save, the colour draining out to skip */}
      <motion.span className="reel__wash reel__wash--save" style={{ opacity: saveWash }} aria-hidden />
      <motion.span className="reel__wash reel__wash--skip" style={{ opacity: skipWash }} aria-hidden />
      <motion.span className="verdict verdict--save" style={{ opacity: save, y: labelY, scale: labelScale }} aria-hidden>
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="currentColor" /></svg>
        <span>Save</span>
      </motion.span>
      <motion.span className="verdict verdict--skip" style={{ opacity: skip, y: labelY, scale: labelScale }} aria-hidden>
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M7 6.5l10 11M17 6.5l-10 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg>
        <span>Skip</span>
      </motion.span>
    </motion.div>
  )
}
