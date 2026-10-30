import { Car } from 'lucide-react'
import type { ReactElement } from 'react'
import { brand, type RouteId } from '../config/brand'
import { useUI } from '../store/useUI'
import { Logo } from './Logo'

const icons: Record<Exclude<RouteId, 'home'>, ReactElement> = {
  artists: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.5 15.6V7.5l5-1.2v2.3l-5 1.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="9.1" cy="15.8" r="1.9" fill="currentColor" />
    </svg>
  ),
  podcasts: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="9.6" y="5.6" width="4.8" height="8.2" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.4 11.6a4.6 4.6 0 0 0 9.2 0M12 16.2v2.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  'inner-circle': (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
    </svg>
  ),
}

/** Three destinations: a bottom bar on phones, a slim rail on wider screens. */
export function TabBar({ route, onChange }: { route: RouteId; onChange: (r: RouteId) => void }) {
  const setDrive = useUI((s) => s.setDrive)
  return (
    <nav className="tabs" aria-label="CIRCA">
      <button className="tabs__logo" aria-current={route === 'home' ? 'page' : undefined} onClick={() => onChange('home')} aria-label={brand.home.label}>
        <Logo size="sm" spinning={route === 'home'} />
      </button>
      {(['artists', 'podcasts', 'inner-circle'] as const).map((id) => (
        <button key={id} className="tab" aria-current={route === id ? 'page' : undefined} onClick={() => onChange(id)}>
          <span className="tab__icon">{icons[id]}</span>
          <span className="tab__label">{brand.stations[id].label}</span>
        </button>
      ))}
      <button className="tab tab--drive" onClick={() => setDrive(true)} aria-label="Drive mode">
        <span className="tab__icon"><Car strokeWidth={1.7} /></span>
        <span className="tab__label">Drive</span>
      </button>
    </nav>
  )
}
