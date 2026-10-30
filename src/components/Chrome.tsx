import { Car, Disc3 } from 'lucide-react'
import { brand, STATION_ORDER, type RouteId } from '../config/brand'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Wordmark } from './Wordmark'

interface NavProps {
  route: RouteId
  onChange: (r: RouteId) => void
}

/** A small vinyl that stands for Your Record. */
export function RecordGlyph({ size = 26, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg className={`record-glyph ${spinning ? 'is-spinning' : ''}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="15.5" fill="var(--vinyl)" />
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="rgba(255,255,255,.13)" strokeWidth=".8" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth=".8" />
      <circle cx="16" cy="16" r="6.4" fill="var(--mustard)" />
      <path d="M16 9.6a6.4 6.4 0 0 1 6.4 6.4H16z" fill="var(--cherry)" />
      <circle cx="16" cy="16" r="1.3" fill="var(--vinyl)" />
    </svg>
  )
}

export function Header({ route, onChange }: NavProps) {
  const count = useStore((s) => s.saved.length)
  const openSheet = useUI((s) => s.openSheet)
  const setDrive = useUI((s) => s.setDrive)
  return (
    <header className="header">
      <button className="header__brand" onClick={() => onChange('home')} aria-label={`${brand.name} — ${brand.home.label}`}>
        <Wordmark />
      </button>
      <nav className="stations stations--top" aria-label="Destinations">
        <button className="station station--home" aria-current={route === 'home' ? 'page' : undefined} onClick={() => onChange('home')}>
          <RecordGlyph size={22} spinning={route === 'home'} />
          <span className="station__label">{brand.home.label}</span>
        </button>
        {STATION_ORDER.map((id) => (
          <button key={id} className="station" aria-current={route === id ? 'page' : undefined} onClick={() => onChange(id)}>
            <span className="station__freq">{brand.stations[id].frequency}</span>
            <span className="station__label">{brand.stations[id].label}</span>
          </button>
        ))}
      </nav>
      <div className="header__actions">
        <button className="chip-btn chip-btn--on-dark" onClick={() => setDrive(true)} aria-label="Drive mode">
          <Car size={17} strokeWidth={1.9} />
          <span>Drive</span>
        </button>
        <button className="chip-btn chip-btn--on-dark chip-btn--library" onClick={() => openSheet({ kind: 'library' })} aria-label={`Your collection, ${count} saved`}>
          <Disc3 size={17} strokeWidth={1.9} />
          <span>Collection</span>
          <em className="count" data-empty={count === 0 ? '' : undefined}>{count}</em>
        </button>
      </div>
    </header>
  )
}

export function BottomNav({ route, onChange }: NavProps) {
  const count = useStore((s) => s.saved.length)
  const openSheet = useUI((s) => s.openSheet)
  const tab = (id: RouteId, label: string) => (
    <button className="bnav__tab" aria-current={route === id ? 'page' : undefined} onClick={() => onChange(id)}>
      <span>{label}</span>
    </button>
  )
  return (
    <nav className="bnav" aria-label="Destinations">
      {tab('artists', brand.stations.artists.label)}
      {tab('podcasts', brand.stations.podcasts.label)}
      <button className="bnav__record" aria-current={route === 'home' ? 'page' : undefined} onClick={() => onChange('home')} aria-label={brand.home.label}>
        <RecordGlyph size={52} spinning={route === 'home'} />
      </button>
      {tab('inner-circle', brand.stations['inner-circle'].label)}
      <button className="bnav__tab" onClick={() => openSheet({ kind: 'library' })}>
        <span>Saved{count ? <em> {count}</em> : null}</span>
      </button>
    </nav>
  )
}
