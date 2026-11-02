import { motion } from 'framer-motion'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { brand } from '../config/brand'
import { tick } from '../lib/haptics'

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
        <circle cx="50" cy="50" r="14" fill="var(--label, #163024)" />
        <rect x="49" y="38.5" width="2" height="5" rx="1" fill="var(--label-mark, #b89c66)" />
      </g>
      <circle cx="50" cy="50" r="2.6" fill="var(--hole, #07120d)" />
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

/**
 * The opening, in three beats. CIRCA rises in with both Cs turning; the
 * letters draw together and fold into a single C; that C flies to its place
 * in the tonearm's pivot on your vinyl and settles there as the room appears.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const box = useRef<HTMLSpanElement>(null)
  const [phase, setPhase] = useState<'in' | 'merge' | 'fly' | 'gone'>('in')
  const [geo, setGeo] = useState<{ rects: DOMRect[]; cx: number; cy: number; target?: { cx: number; cy: number; size: number } } | null>(null)
  const done = useRef(onDone)
  useLayoutEffect(() => {
    done.current = onDone
  })

  useLayoutEffect(() => {
    // Each letter's resting place (its layout box, ignoring any animation transform), measured
    // when it's about to move, so a late-loading font can't leave the C off its mark.
    const measure = () => {
      const logo = box.current
      if (!logo) return []
      const o = logo.getBoundingClientRect()
      return [...logo.children].map((k) => {
        const el = k as HTMLElement
        return new DOMRect(o.left + el.offsetLeft, o.top + el.offsetTop, el.offsetWidth, el.offsetHeight)
      })
    }
    setGeo({ rects: measure(), cx: window.innerWidth / 2, cy: window.innerHeight / 2 })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = (ms: number, f: () => void) => window.setTimeout(f, reduce ? ms / 3 : ms)
    // the real C on the arm waits, hidden, until this one has clicked into place
    const root = document.documentElement
    root.classList.add('is-intro')
    const timers = [
      t(820, () => {
        setGeo((g) => (g ? { ...g, rects: measure() } : g))
        setPhase('merge')
      }),
      t(1500, () => {
        // Where the C lives: the tonearm's pivot on Home. On any other page it flies to that same
        // corner (Home's C, measured as if Home were in view) and fades out there.
        const home = document.querySelector<HTMLElement>('.view[data-route="vinyl"] .hifi__settings .record-c')
        const view = home?.closest<HTMLElement>('.view')
        const shift = view && view.parentElement ? view.getBoundingClientRect().left - view.parentElement.getBoundingClientRect().left : 0
        const hr = home?.getBoundingClientRect()
        const el = hr && hr.width > 0 ? null : document.querySelector<HTMLElement>('.tab--vinyl .tab__disc')
        const r = el ? el.getBoundingClientRect() : hr ? new DOMRect(hr.left - shift, hr.top, hr.width, hr.height) : undefined
        setGeo((g) => (g && r ? { ...g, rects: measure(), target: { cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: r.width } } : g))
        setPhase('fly')
      }),
      // touchdown: a small settle and a tick under the finger
      t(2280, () => tick('firm')),
      t(2380, () => {
        setPhase('gone')
        root.classList.remove('is-intro')
      }),
      t(2700, () => done.current()),
    ]
    return () => {
      timers.forEach(clearTimeout)
      root.classList.remove('is-intro')
    }
  }, [])

  const name = brand.name.toUpperCase()
  const firstC = name.indexOf('C')
  const ease = [0.65, 0, 0.2, 1] as const
  return (
    <div className="splash" aria-hidden>
      <motion.div className="splash__room" animate={{ opacity: phase === 'fly' || phase === 'gone' ? 0 : 1 }} transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }} />
      <span ref={box} className="logo logo--xl splash__logo">
        {name.split('').map((ch, i) => {
          const r = geo?.rects[i]
          const toCentre = r && geo ? { x: geo.cx - (r.left + r.width / 2), y: geo.cy - (r.top + r.height / 2) } : { x: 0, y: 0 }
          const isHero = i === firstC
          let animate: Record<string, number> = { opacity: 1, x: 0, y: 0, scale: 1 }
          let transition: Record<string, unknown> = { duration: 0.5, delay: 0.02 + i * 0.07, ease: [0.16, 1, 0.3, 1] }
          if (phase === 'merge')
            animate = isHero ? { opacity: 1, ...toCentre, scale: 1.18 } : { opacity: 0, ...toCentre, scale: ch === 'C' ? 1.18 : 0.4 }
          if (phase !== 'in') transition = { duration: 0.62, ease }
          if ((phase === 'fly' || phase === 'gone') && isHero && r && geo?.target)
            animate = {
              opacity: phase === 'gone' ? 0 : 1,
              x: geo.target.cx - (r.left + r.width / 2),
              y: geo.target.cy - (r.top + r.height / 2),
              scale: geo.target.size / r.width,
            }
          if (phase === 'fly' && isHero)
            transition = {
              x: { duration: 0.8, ease: [0.7, 0, 0.18, 1] },
              y: { duration: 0.8, ease: [0.7, 0, 0.18, 1] },
              // it arrives a touch large and settles into the socket
              scale: { duration: 0.8, ease: [0.55, 0, 0.3, 1.45] },
            }
          // in its corner, it fades away (on Home the real C is underneath and takes over)
          if (phase === 'gone' && isHero) transition = { duration: 0.45, ease: 'easeOut' }
          if ((phase === 'fly' || phase === 'gone') && !isHero) animate = { opacity: 0, ...toCentre, scale: 0.4 }
          return (
            <motion.span key={i} className="splash__ch" initial={{ opacity: 0, y: 18 }} animate={animate} transition={transition}>
              {ch === 'C' ? <RecordC spinning /> : <span className="logo__ch">{ch}</span>}
            </motion.span>
          )
        })}
      </span>
    </div>
  )
}
