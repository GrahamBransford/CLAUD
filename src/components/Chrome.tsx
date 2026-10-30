import type { ReactElement } from 'react'
import { brand, type RouteId, type StationId } from '../config/brand'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import * as I from './Icons'
import { Logo } from './Logo'

const icons: Record<StationId, ReactElement> = {
  artists: <I.StationArtists />,
  podcasts: <I.StationPodcasts />,
  'inner-circle': <I.StationCircle />,
}

/**
 * Three ways in, then you: a bottom bar on phones, a slim rail on wider
 * screens. My Vinyl is a small record standing proud of the bar, its label
 * your photo.
 */
export function TabBar({ route, onChange }: { route: RouteId; onChange: (r: RouteId) => void }) {
  const setDrive = useUI((s) => s.setDrive)
  const avatar = useStore((s) => s.profile.avatar)
  const incoming = useStore((s) => Object.values(s.friends).some((f) => f === 'incoming'))
  return (
    <nav className="tabs" aria-label="CIRCA">
      <span className="tabs__logo" aria-hidden>
        <Logo size="sm" />
      </span>
      {(['artists', 'podcasts', 'inner-circle'] as const).map((id) => (
        <button key={id} className="tab" aria-current={route === id ? 'page' : undefined} onClick={() => onChange(id)}>
          <span className="tab__icon">{icons[id]}</span>
          <span className="tab__label">{brand.stations[id].label}</span>
        </button>
      ))}
      <button className="tab tab--vinyl" aria-current={route === 'vinyl' ? 'page' : undefined} onClick={() => onChange('vinyl')}>
        <span className="tab__disc" aria-hidden>
          <span className="tab__label-photo">{avatar && <img src={avatar} alt="" />}</span>
          {incoming && <i className="tab__lamp" />}
        </span>
        <span className="tab__label">{brand.vinyl.label}</span>
      </button>
      <button className="tab tab--drive" onClick={() => setDrive(true)} aria-label="Drive mode">
        <span className="tab__icon"><I.Car /></span>
        <span className="tab__label">Drive</span>
      </button>
    </nav>
  )
}
