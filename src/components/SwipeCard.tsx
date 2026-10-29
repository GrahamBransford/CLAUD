import { motion, useMotionValue, useTransform, type PanInfo, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

export type SwipeDir = -1 | 1

interface Props {
  children: ReactNode
  onSwipe: (dir: SwipeDir) => void
  /** Direction the card leaves in; pass the same value as AnimatePresence `custom`. */
  exitDir: SwipeDir
  className?: string
  keepLabel?: string
  passLabel?: string
  disabled?: boolean
}

const THRESHOLD = 110

const variants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 10 },
  enter: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] as const } },
  exit: (dir: SwipeDir) => ({
    x: dir * 620,
    rotate: dir * 14,
    opacity: 0,
    transition: { duration: 0.38, ease: [0.4, 0, 0.6, 1] as const },
  }),
}

/**
 * A draggable sleeve: drag right to keep, left to pass. Vertical scrolling is
 * left to the browser (touch-action: pan-y) so swipes never fight the page.
 */
export function SwipeCard({ children, onSwipe, exitDir, className, keepLabel = 'Keep', passLabel = 'Pass', disabled }: Props) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-7, 7])
  const keep = useTransform(x, [20, THRESHOLD], [0, 1])
  const pass = useTransform(x, [-THRESHOLD, -20], [1, 0])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > THRESHOLD || info.velocity.x > 700) onSwipe(1)
    else if (info.offset.x < -THRESHOLD || info.velocity.x < -700) onSwipe(-1)
  }

  return (
    <motion.div
      className={`swipe-card ${className ?? ''}`}
      style={{ x, rotate }}
      drag={disabled ? false : 'x'}
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      variants={variants}
      custom={exitDir}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      {children}
      <motion.span className="stamp stamp--keep" style={{ opacity: keep }} aria-hidden>
        {keepLabel}
      </motion.span>
      <motion.span className="stamp stamp--pass" style={{ opacity: pass }} aria-hidden>
        {passLabel}
      </motion.span>
    </motion.div>
  )
}
