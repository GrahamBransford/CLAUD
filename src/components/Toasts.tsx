import { AnimatePresence, motion } from 'framer-motion'
import { useUI } from '../store/useUI'

/** One quiet line at a time, at the top, clear of the controls. */
export function Toasts() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className="toast"
            layout
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 0.7, 0.18, 1] } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
          >
            {t.image && <img className="toast__img" src={t.image} alt="" />}
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
