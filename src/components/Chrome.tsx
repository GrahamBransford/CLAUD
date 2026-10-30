import { useEffect, useRef, type ReactElement } from 'react'
import { brand, type RouteId, type StationId } from '../config/brand'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import * as I from './Icons'
import { Logo } from './Logo'
import { clockAngle } from './Turntable'

const icons: Record<StationId, ReactElement> = {
  artists: <I.StationArtists />,
  podcasts: <I.StationPodcasts />,
  'inner-circle': <I.StationCircle />,
}

/**
 * Three ways in, then you, as icons only: a bottom bar on phones, a slim rail on wider
 * screens. My Vinyl is a small record in line with the rest, its label your
 * photo, turning in step with the big one.
 */
export function TabBar({ route, onChange }: { route: RouteId; onChange: (r: RouteId) => void }) {
  const setDrive = useUI((s) => s.setDrive)
  const avatar = useStore((s) => s.profile.avatar)
  const incoming = useStore((s) => Object.values(s.friends).some((f) => f === 'incoming'))
  const label = useRef<HTMLSpanElement>(null)

  // The small record always turns, in step with the big one.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const tick = () => {
      if (label.current) label.current.style.transform = `rotate(${clockAngle().toFixed(2)}deg)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <nav className="tabs" aria-label="CIRCA">
      <span className="tabs__logo" aria-hidden>
        <Logo size="sm" />
      </span>
      {(['artists', 'podcasts', 'inner-circle'] as const).map((id) => (
        <button key={id} className={`tab tab--${id}`} aria-current={route === id ? 'page' : undefined} onClick={() => onChange(id)} aria-label={brand.stations[id].label}>
          <span className="tab__icon">{icons[id]}</span>
        </button>
      ))}
      <button className="tab tab--vinyl" aria-current={route === 'vinyl' ? 'page' : undefined} onClick={() => onChange('vinyl')} aria-label={brand.vinyl.label}>
        <span className="tab__disc" aria-hidden>
          <span className="tab__label-photo" ref={label}>
            {avatar && <img src={avatar} alt="" />}
          </span>
          {incoming && <i className="tab__lamp" />}
        </span>
      </button>
      <button className="tab tab--drive" onClick={() => setDrive(true)} aria-label="Drive mode">
        <span className="tab__icon"><I.Car /></span>
      </button>
    </nav>
  )
}
