import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { brand, type RouteId, type StationId } from '../config/brand'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import * as I from './Icons'
import { Logo } from './Logo'
import { clockAngle, DEG_PER_S } from './Turntable'

const icons: Record<StationId, ReactElement> = {
  artists: <I.StationArtists />,
  podcasts: <I.StationPodcasts />,
  'inner-circle': <I.StationCircle />,
}
const TABS: RouteId[] = ['artists', 'podcasts', 'inner-circle', 'vinyl']

/**
 * Every destination is a small record. One tonearm rides the bar like a
 * library ladder on its rail: it lifts, glides to the record you chose and
 * sets down on it, and only that record turns. A bottom bar on phones, a
 * slim rail (the arm travels vertically) on wider screens.
 */
export function TabBar({ route, onChange }: { route: RouteId; onChange: (r: RouteId) => void }) {
  const setDrive = useUI((s) => s.setDrive)
  const avatar = useStore((s) => s.profile.avatar)
  const incoming = useStore((s) => Object.values(s.friends).some((f) => f === 'incoming'))
  const nav = useRef<HTMLElement>(null)
  const discs = useRef<Record<string, HTMLSpanElement | null>>({})
  const labels = useRef<Record<string, HTMLSpanElement | null>>({})
  const [arm, setArm] = useState<{ x: number; y: number } | null>(null)
  const [moving, setMoving] = useState(false)
  const first = useRef(true)

  // Park the arm over the selected record; re-measure when the layout changes.
  useLayoutEffect(() => {
    const place = () => {
      const d = discs.current[route]
      if (!d || !nav.current) return
      const n = nav.current.getBoundingClientRect()
      const r = d.getBoundingClientRect()
      setArm({ x: r.left - n.left + r.width / 2, y: r.top - n.top + r.height / 2 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [route])

  // Lift for the journey, set down on arrival (the first placement just appears).
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setMoving(true)
    const t = window.setTimeout(() => setMoving(false), 560)
    return () => window.clearTimeout(t)
  }, [route])

  // The record under the stylus turns, in step with the big one; the others coast to a stop.
  const playing = moving ? null : route
  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const state: Record<string, { a: number; v: number }> = Object.fromEntries(TABS.map((t) => [t, { a: 0, v: 0 }]))
    const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const dt = Math.min(1, (now - last) / 1000)
      last = now
      for (const t of TABS) {
        const s = state[t]
        const on = playingRef.current === t
        s.v += ((on ? 1 : 0) - s.v) * (1 - Math.exp(-dt / (on ? 0.3 : 0.5)))
        s.a += s.v * DEG_PER_S * dt
        if (on) s.a += wrap(clockAngle() - s.a) * (1 - Math.exp(-dt / 0.8)) * s.v
        const el = labels.current[t]
        if (el) el.style.transform = `rotate(${s.a.toFixed(2)}deg)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <nav ref={nav} className="tabs" aria-label="CIRCA">
      {/* on the desktop rail the logo opens settings, as the C does on phones */}
      <button className="tabs__logo" onClick={() => useUI.getState().openSheet({ kind: 'settings' })} aria-label="Settings">
        <Logo size="sm" />
      </button>
      {TABS.map((id) => (
        <button
          key={id}
          className={`tab tab--${id}`}
          aria-current={route === id ? 'page' : undefined}
          onClick={() => onChange(id)}
          aria-label={id === 'vinyl' ? brand.vinyl.label : brand.stations[id].label}
        >
          <span className="tab__disc" ref={(el) => void (discs.current[id] = el)} aria-hidden>
            <span className={`tab__art ${id === 'vinyl' ? 'tab__art--photo' : ''}`} ref={(el) => void (labels.current[id] = el)}>
              {id === 'vinyl' ? avatar && <img src={avatar} alt="" /> : icons[id]}
            </span>
            {id === 'vinyl' && incoming && <i className="tab__lamp" />}
          </span>
        </button>
      ))}
      <button className="tab tab--drive" onClick={() => setDrive(true)} aria-label="Drive mode">
        <span className="tab__icon"><I.Car /></span>
      </button>
      {arm && (
        <span className={`tabs__arm ${moving ? 'is-moving' : ''}`} style={{ transform: `translate(${arm.x}px, ${arm.y}px)` }} aria-hidden>
          <svg viewBox="0 0 40 40" className="tabs__arm-swing">
            <defs>
              <linearGradient id="tab-arm" x1="0" x2="1">
                <stop offset="0" stopColor="#8a8c91" />
                <stop offset=".4" stopColor="#f2f1ee" />
                <stop offset="1" stopColor="#6d6f75" />
              </linearGradient>
            </defs>
            <path d="M31 8 Q30 19 21 25" fill="none" stroke="url(#tab-arm)" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="17.4" y="23.2" width="5" height="3.4" rx=".8" transform="rotate(38 19.9 24.9)" fill="var(--cherry)" />
            <circle cx="31" cy="8" r="3.6" fill="#2a2420" />
            <circle cx="31" cy="8" r="2.4" fill="url(#tab-arm)" />
          </svg>
        </span>
      )}
    </nav>
  )
}
