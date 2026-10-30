import { useId } from 'react'
import { brand } from '../config/brand'

/**
 * A "C" cut from a record: a grooved ring with its mouth open to the right,
 * and the label sitting in the counter. The ring (the letterform) stays
 * still; the grooves and label turn inside it, so it always reads as a C.
 */
export function RecordC({ spinning = false }: { spinning?: boolean }) {
  const id = useId().replace(/:/g, '')
  const gap = (40 * Math.PI) / 180
  const ox = 50 + 48 * Math.cos(gap)
  const oy = 48 * Math.sin(gap)
  const ix = 50 + 25 * Math.cos(gap)
  const iy = 25 * Math.sin(gap)
  // ring from +40° round the left to −40°, outer edge then inner edge back
  const ring = `M ${ox} ${50 - oy} A 48 48 0 1 0 ${ox} ${50 + oy} L ${ix} ${50 + iy} A 25 25 0 1 1 ${ix} ${50 - iy} Z`
  return (
    <svg className={`record-c ${spinning ? 'is-spinning' : ''}`} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <clipPath id={`c-${id}`}>
          <path d={ring} />
        </clipPath>
      </defs>
      <g clipPath={`url(#c-${id})`}>
        <rect width="100" height="100" fill="currentColor" />
        <g className="record-c__spin">
          {[44, 40, 36, 32, 28].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="var(--groove, rgba(0,0,0,.28))" strokeWidth="1.1" />
          ))}
          {/* a sweep of light so the turning is visible */}
          <path d="M50 50 L50 1 A49 49 0 0 1 84 15 Z" fill="var(--groove, rgba(0,0,0,.28))" opacity="0.5" />
        </g>
      </g>
      <g className="record-c__spin">
        <circle cx="50" cy="50" r="14" fill="var(--label, #c21f32)" />
        <rect x="49" y="38.5" width="2" height="5" rx="1" fill="var(--label-mark, #f2b42c)" />
      </g>
      <circle cx="50" cy="50" r="2.6" fill="var(--hole, #15100d)" />
    </svg>
  )
}

/** CIRCA, with both Cs pressed from vinyl. */
export function Logo({ size = 'md', spinning = false }: { size?: 'sm' | 'md' | 'xl'; spinning?: boolean }) {
  const name = brand.name.toUpperCase()
  return (
    <span className={`logo logo--${size}`} role="img" aria-label={brand.name}>
      {name.split('').map((ch, i) =>
        ch === 'C' ? <RecordC key={i} spinning={spinning} /> : <span key={i} className="logo__ch" aria-hidden>{ch}</span>,
      )}
    </span>
  )
}

/** The opening: the Cs spin up, the letters settle, and the app is there. */
export function Splash({ onDone }: { onDone: () => void }) {
  return (
    <div className="splash" onAnimationEnd={(e) => e.target === e.currentTarget && onDone()}>
      <Logo size="xl" spinning />
    </div>
  )
}
