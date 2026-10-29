import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

/** Right-hand drawer on desktop, bottom sheet on mobile. */
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-root">
      <motion.div className="sheet-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside
        className={`sheet ${wide ? 'sheet--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ x: '100%', y: 0 }}
        animate={{ x: 0, y: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 40 }}
      >
        <button className="sheet__close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        {children}
      </motion.aside>
    </div>
  )
}
