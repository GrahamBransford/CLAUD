import { Car } from 'lucide-react'
import type { ReactElement } from 'react'
import { brand, type RouteId } from '../config/brand'
import { useUI } from '../store/useUI'
import { Logo } from './Logo'

const icons: Record<Exclude<RouteId, 'home'>, ReactElement> = {
  artists: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10.5 15.6V7.5l5-1.2v2.3l-5 1.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="9.1" cy="15.8" r="1.9" fill="currentColor" />
    </svg>
  ),
  podcasts: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="8.2" y="2.6" width="7.6" height="12" rx="3.8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.2 7.4h7.6M8.2 10.2h7.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.2 11.2a6.8 6.8 0 0 0 13.6 0M12 18v3.4M8.6 21.4h6.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  'inner-circle': (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
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
