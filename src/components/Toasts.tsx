import { AnimatePresence, motion } from 'framer-motion'
import { Check, Heart, UserPlus } from 'lucide-react'
import { useUI } from '../store/useUI'

export function Toasts() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast--${t.tone ?? 'info'}`}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            {t.image ? (
              <img className="toast__img" src={t.image} alt="" />
            ) : (
              <span className="toast__icon">
                {t.tone === 'save' ? <Heart size={16} /> : t.tone === 'follow' ? <UserPlus size={16} /> : <Check size={16} />}
              </span>
            )}
            <span className="toast__text">
              <strong>{t.title}</strong>
              {t.detail && <span>{t.detail}</span>}
            </span>
            {t.action && (
              <button
                className="toast__action"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
