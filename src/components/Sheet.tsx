import { motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'

const EASE = [0.22, 0.7, 0.18, 1] as const

/** A bottom sheet: slides up, drags down to dismiss, Escape closes. */
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-root">
      <motion.div className="sheet-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
      <motion.div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { duration: 0.36, ease: EASE } }}
        exit={{ y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 0.7, 0.2] } }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, i) => (i.offset.y > 90 || i.velocity.y > 500) && onClose()}
      >
        <span className="sheet__handle" aria-hidden />
        {children}
      </motion.div>
    </div>
  )
}
