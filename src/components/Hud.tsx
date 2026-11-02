import { AnimatePresence, motion } from 'framer-motion'
import * as I from './Icons'
import { useCallback, useRef, useState } from 'react'

export function useTapFlash() {
  const [state, setState] = useState<{ kind: 'play' | 'pause'; n: number } | null>(null)
  const timer = useRef(0)
  const show = useCallback((kind: 'play' | 'pause') => {
    window.clearTimeout(timer.current)
    setState((s) => ({ kind, n: (s?.n ?? 0) + 1 }))
    timer.current = window.setTimeout(() => setState(null), 520)
  }, [])
  return { state, show }
}

/** The brief play/pause glyph after a tap. */
export function TapFlash({ state }: { state: { kind: 'play' | 'pause'; n: number } | null }) {
  return (
    <AnimatePresence>
      {state && (
        <motion.span
          key={state.n}
          className="tapflash"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.14 } }}
          exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.26 } }}
          aria-hidden
        >
          {state.kind === 'play' ? <I.Play size={34} /> : <I.Pause size={34} />}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
