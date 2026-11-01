import { useState } from 'react'
import { creatorById } from '../data'
import { useProfile } from '../hooks/useProfile'
import { formatTop } from '../lib/affinity'
import { fmtHours, fmtMinutes, type CreatorStats, type ListeningProfile, type Owner } from '../lib/profile'
import { useUI, type DetailTab } from '../store/useUI'
import type { Experience } from '../types'
import * as I from './Icons'
import { Sheet } from './Sheet'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'listening', label: 'Listening' },
  { id: 'artists', label: 'Artists' },
  { id: 'podcasts', label: 'Podcasts' },
  { id: 'genres', label: 'Genres' },
  { id: 'live', label: 'Live' },
]

/**
 * The long read behind a vinyl: listening time, top artists and podcasts,
 * genres and how they're listened to, and the shows lived. One sheet, five
 * tabs, the same for every account.
 */
export function ProfileDetails({ owner, tab: initial }: { owner: Owner; tab: DetailTab }) {
  const profile = useProfile(owner)
  const [tab, setTab] = useState<DetailTab>(initial)
  const close = () => useUI.getState().openSheet(null)
  if (!profile) return null
  const title = owner === 'me' ? 'Your listening' : `${profile.who}’s listening`
  return (
    <Sheet label={title} onClose={close}>
      <div className="details">
        <header className="details__head">
          <h2>{title}</h2>
          <span className="details__demo">Estimates · demo</span>
        </header>
        <nav className="details__tabs" role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className="details__tab" onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="details__body" role="tabpanel">
          {tab === 'listening' && <Listening p={profile} />}
          {tab === 'artists' && <Artists p={profile} />}
          {tab === 'podcasts' && <Podcasts p={profile} />}
          {tab === 'genres' && <Genres p={profile} />}
          {tab === 'live' && <LiveHistory experiences={profile.experiences} who={profile.who} />}
        </div>
      </div>
    </Sheet>
  )
}

const openCreator = (creatorId: string, owner: Owner) => useUI.getState().openSheet({ kind: 'creator', creatorId, owner })

function Listening({ p }: { p: ListeningProfile }) {
  const m = p.minutes
  const peak = Math.max(1, ...p.weekly)
  const cells: [string, number][] = [
    ['This week', m.week],
    ['This month', m.month],
    ['This year', m.year],
    ['All time', m.all],
  ]
  return (
    <>
      <div className="periods">
        {cells.map(([label, v]) => (
          <div key={label} className="period">
            <span className="period__label">{label}</span>
            <strong className="period__value">{fmtMinutes(v)}</strong>
            <span className="period__unit">minutes · {fmtHours(v)}</span>
          </div>
        ))}
      </div>
      <div className="weeks" aria-label="Minutes per week, last eight weeks">
        {p.weekly.map((v, i) => (
          <span key={i} className={`weeks__bar ${i === 7 ? 'is-now' : ''}`} style={{ height: `${Math.max(6, (v / peak) * 100)}%` }} title={`${v} min`} />
        ))}
      </div>
      <p className="weeks__caption">The last eight weeks</p>
      <dl className="facts">
        <div>
          <dt>Music · talk</dt>
          <dd>
            {Math.round(p.musicShare * 100)}% · {100 - Math.round(p.musicShare * 100)}%
          </dd>
        </div>
        <div>
          <dt>Heard all the way through</dt>
          <dd>{Math.round(p.completionRate * 100)}%</dd>
        </div>
        <div>
          <dt>Listens most</dt>
          <dd>{p.peak}</dd>
        </div>
      </dl>
    </>
  )
}

function Row({ s, rank, owner, detail }: { s: CreatorStats; rank: number; owner: Owner; detail: string }) {
  const c = creatorById[s.creatorId]
  return (
    <li>
      <button className="rank" onClick={() => openCreator(s.creatorId, owner)}>
        <span className="rank__n">{rank}</span>
        <img className="rank__img" src={c.avatar} alt="" />
        <span className="rank__text">
          <strong>{c.name}</strong>
          <em>{detail}</em>
        </span>
        <span className="rank__right">
          <strong>{fmtMinutes(s.minutes)}</strong>
          <em>min</em>
        </span>
      </button>
    </li>
  )
}

function Artists({ p }: { p: ListeningProfile }) {
  const [view, setView] = useState<'top' | 'style'>('top')
  const list = view === 'style' && p.style ? p.style.artists : p.artists.slice(0, 10)
  return (
    <>
      {p.style && (
        <div className="seg" role="tablist" aria-label="Which artists">
          <button role="tab" aria-selected={view === 'top'} onClick={() => setView('top')}>
            Top {Math.min(10, p.artists.length)}
          </button>
          <button role="tab" aria-selected={view === 'style'} onClick={() => setView('style')}>
            Top 3 in {p.style.name}
          </button>
        </div>
      )}
      {view === 'style' && p.style && (
        <p className="details__note">
          {Math.round(p.style.share * 100)}% of {p.who === 'You' ? 'your' : `${p.who}’s`} music is {p.style.name}.
        </p>
      )}
      <ol className="ranks">
        {list.map((s, i) => (
          <Row key={s.creatorId} s={s} rank={i + 1} owner={p.owner} detail={`${creatorById[s.creatorId].genre} · ${formatTop(s.top)}`} />
        ))}
      </ol>
      {view === 'top' && p.artists.length < 10 && <p className="details__note">Every artist on the record so far.</p>}
    </>
  )
}

function Podcasts({ p }: { p: ListeningProfile }) {
  return (
    <ol className="ranks">
      {p.podcasts.slice(0, 5).map((s, i) => (
        <Row key={s.creatorId} s={s} rank={i + 1} owner={p.owner} detail={`${s.completions} ${s.completions === 1 ? 'episode' : 'episodes'} finished · ${formatTop(s.top)}`} />
      ))}
    </ol>
  )
}

function Genres({ p }: { p: ListeningProfile }) {
  return (
    <>
      <p className="details__note">What {p.who === 'You' ? 'you listen' : `${p.who} listens`} to, and how.</p>
      <ul className="genres">
        {p.genres.map((g) => (
          <li key={g.genre} className="genre">
            <div className="genre__top">
              <strong>{g.genre}</strong>
              <span>{Math.round(g.share * 100)}%</span>
            </div>
            <span className="genre__bar">
              <i style={{ width: `${Math.max(3, g.share * 100)}%` }} />
            </span>
            <p className="genre__how">
              {g.how} · {fmtHours(g.minutes)}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}

const KIND: Record<string, string> = { concert: 'Concert', festival: 'Festival', performance: 'Live taping', other: 'Experience' }

/** The shows someone has lived, as a timeline. Self-reported, and labelled so. */
export function LiveHistory({ experiences, who }: { experiences: Experience[]; who: string }) {
  const byYear = new Map<string, Experience[]>()
  for (const x of [...experiences].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))) {
    const k = x.year ? String(x.year) : 'Undated'
    byYear.set(k, [...(byYear.get(k) ?? []), x])
  }
  if (!experiences.length) return <p className="details__note">{who === 'You' ? 'No shows yet. Add one under Live.' : `${who} hasn’t added any shows yet.`}</p>
  return (
    <div className="live">
      <LiveStats experiences={experiences} />
      {[...byYear.entries()].map(([year, xs]) => (
        <section key={year} className="live__year">
          <h3>{year}</h3>
          <ul>
            {xs.map((x) => {
              const c = x.creatorId ? creatorById[x.creatorId] : undefined
              return (
                <li key={x.id} className="live__item">
                  {c ? <img src={c.avatar} alt="" /> : <span className="live__ticket"><I.Ticket size={16} /></span>}
                  <span className="live__text">
                    <strong>{x.kind === 'festival' ? x.title : (c?.name ?? x.title)}</strong>
                    <em>{[KIND[x.kind], x.place].filter(Boolean).join(' · ')}</em>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="details__note">Self-reported, never verified.</p>
    </div>
  )
}

/** Shows, artists, venues and the first year: the headline of someone's live history. */
export function LiveStats({ experiences }: { experiences: Experience[] }) {
  const shows = experiences.filter((x) => x.kind !== 'other')
  const artists = new Set(shows.map((x) => x.creatorId).filter(Boolean))
  const places = new Set(shows.map((x) => x.place).filter(Boolean))
  const since = Math.min(...experiences.map((x) => x.year ?? 9999))
  return (
      <dl className="live__stats">
      <div>
        <dt>Shows</dt>
        <dd>{shows.length}</dd>
      </div>
      <div>
        <dt>Artists</dt>
        <dd>{artists.size}</dd>
      </div>
      <div>
        <dt>Venues</dt>
        <dd>{places.size}</dd>
      </div>
      <div>
        <dt>Since</dt>
        <dd>{since < 9999 ? since : '—'}</dd>
      </div>
    </dl>
  )
}
