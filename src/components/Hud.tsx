import { AnimatePresence, motion } from 'framer-motion'
import * as I from './Icons'
import { useCallback, useRef, useState } from 'react'
import { useUI } from '../store/useUI'
import { RecordC } from './Logo'

/** CIRCA's record C (it turns while something plays), sound-off badge, Drive. */
export function TopBar({ playing, drive = true }: { playing: boolean; muted?: boolean; drive?: boolean }) {
  const unlocked = useUI((s) => s.audioUnlocked)
  return (
    <div className="topbar">
      {/* the C opens settings: your account first, then the rest */}
      <button className="topbar__logo" onClick={() => useUI.getState().openSheet({ kind: 'settings' })} aria-label="Settings">
        <RecordC spinning={playing} />
      </button>
      <span className="topbar__right">
        {!unlocked && (
          <button className="topbar__btn" onClick={() => useUI.getState().unlockAudio()} aria-label="Turn sound on">
            <I.Muted size={19} />
          </button>
        )}
        {drive && (
          <button className="topbar__btn topbar__btn--drive" onClick={() => useUI.getState().setDrive(true)} aria-label="Drive mode">
            <I.Car size={20} />
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
          {state.kind === 'play' ? <I.Play size={34} /> : <I.Pause size={34} />}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
