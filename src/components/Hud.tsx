import { AnimatePresence, motion } from 'framer-motion'
import { Car, Pause, Play, VolumeX } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useUI } from '../store/useUI'
import { Logo } from './Logo'

/** Small logo (its Cs turn while something plays), sound-off badge, Drive. */
export function TopBar({ playing, drive = true }: { playing: boolean; muted?: boolean; drive?: boolean }) {
  const unlocked = useUI((s) => s.audioUnlocked)
  return (
    <div className="topbar">
      {/* the logo is the way to Your Record */}
      <button className="topbar__logo" onClick={() => (window.location.hash = 'home')} aria-label="Your Record">
        <Logo size="sm" spinning={playing} />
      </button>
      <span className="topbar__right">
        {!unlocked && (
          <button className="topbar__btn" onClick={() => useUI.getState().unlockAudio()} aria-label="Turn sound on">
            <VolumeX size={18} />
          </button>
        )}
        {drive && (
          <button className="topbar__btn topbar__btn--drive" onClick={() => useUI.getState().setDrive(true)} aria-label="Drive mode">
            <Car size={19} strokeWidth={1.8} />
          </button>
        )}
      </span>
    </div>
  )
}

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
          {state.kind === 'play' ? <Play size={34} fill="currentColor" /> : <Pause size={34} fill="currentColor" />}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
