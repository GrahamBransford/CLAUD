import { motion, useMotionValue, useTransform, type PanInfo, type Variants } from 'framer-motion'
import { useRef, type ReactNode } from 'react'

/** How the current item left: judged sideways, or browsed vertically. */
export type Move = 'save' | 'pass' | 'next' | 'prev'

const EASE = [0.22, 0.7, 0.18, 1] as const
const T = { duration: 0.34, ease: EASE }

const variants: Variants = {
  initial: (m: Move) =>
    m === 'next' ? { y: '100%', opacity: 1 } : m === 'prev' ? { y: '-100%', opacity: 1 } : { scale: 0.96, opacity: 0 },
  enter: { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0, transition: T },
  exit: (m: Move) =>
    m === 'save'
      ? { x: '115%', rotate: 5, transition: T }
      : m === 'pass'
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
 * sideways judges (right = SAVE, left = PASS), up/down browses.
 */
export function Reel({ move, onMove, onTap, canPrev, children, className }: Props) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const axis = useRef<'x' | 'y' | null>(null)
  const save = useTransform(x, [16, X], [0, 1])
  const pass = useTransform(x, [-X, -16], [1, 0])
  const tilt = useTransform(x, [-400, 400], [-4, 4])

  const end = (_: unknown, i: PanInfo) => {
    if (axis.current === 'x') {
      if (i.offset.x > X || i.velocity.x > 650) onMove('save')
      else if (i.offset.x < -X || i.velocity.x < -650) onMove('pass')
    } else if (axis.current === 'y') {
      if (i.offset.y < -Y || i.velocity.y < -550) onMove('next')
      else if ((i.offset.y > Y || i.velocity.y > 550) && canPrev) onMove('prev')
    }
    axis.current = null
  }

  return (
    <motion.div
      className={`reel ${className ?? ''}`}
      style={{ x, y, rotate: tilt }}
      drag
      dragDirectionLock
      onDirectionLock={(a) => (axis.current = a)}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={{ left: 0.9, right: 0.9, top: 0.55, bottom: canPrev ? 0.55 : 0.12 }}
      dragTransition={{ bounceStiffness: 520, bounceDamping: 42 }}
      onDragEnd={end}
      onTap={(e) => {
        // taps on the creator name or a pill are their own actions
        if (!(e.target as Element).closest('button')) onTap?.()
      }}
      custom={move}
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      {children}
      <motion.span className="verdict verdict--save" style={{ opacity: save }} aria-hidden>SAVE</motion.span>
      <motion.span className="verdict verdict--pass" style={{ opacity: pass }} aria-hidden>PASS</motion.span>
    </motion.div>
  )
}
