import { Car, Disc3 } from 'lucide-react'
import { brand, STATION_ORDER, type StationId } from '../config/brand'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Wordmark } from './Wordmark'

interface NavProps {
  station: StationId
  onChange: (s: StationId) => void
}

function StationTabs({ station, onChange, variant }: NavProps & { variant: 'top' | 'bottom' }) {
  return (
    <nav className={`stations stations--${variant}`} aria-label="Stations">
      {STATION_ORDER.map((id) => {
        const s = brand.stations[id]
        return (
          <button
            key={id}
            className="station"
            aria-current={station === id ? 'page' : undefined}
            onClick={() => onChange(id)}
          >
            <span className="station__freq">{s.frequency}</span>
            <span className="station__label">{s.label}</span>
            <span className="station__kicker">{s.kicker}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function Header({ station, onChange }: NavProps) {
  const count = useStore((s) => s.saved.length)
  const openSheet = useUI((s) => s.openSheet)
  const setDrive = useUI((s) => s.setDrive)
  return (
    <header className="header">
      <a className="header__brand" href="#singers" onClick={() => onChange('singers')}>
        <Wordmark />
        <span className="header__tagline">{brand.tagline}</span>
      </a>
      <StationTabs station={station} onChange={onChange} variant="top" />
      <div className="header__actions">
        <button className="chip-btn" onClick={() => setDrive(true)} aria-label="Drive mode">
          <Car size={17} strokeWidth={1.75} />
          <span>Drive</span>
        </button>
        <button className="chip-btn chip-btn--library" onClick={() => openSheet({ kind: 'library' })} aria-label={`Your collection, ${count} saved`}>
          <Disc3 size={17} strokeWidth={1.75} />
          <span>Collection</span>
          <em className="count" data-empty={count === 0 ? '' : undefined}>{count}</em>
        </button>
      </div>
    </header>
  )
}

export function BottomNav(props: NavProps) {
  return (
    <div className="bottom-nav">
      <StationTabs {...props} variant="bottom" />
    </div>
  )
}
