import { useEffect, useMemo, useRef, useState } from 'react'
import { brand } from '../config/brand'
import { creatorById } from '../data'
import * as I from '../components/Icons'
import { Catalog } from '../components/Catalog'
import { Turntable, type Marker } from '../components/Turntable'
import { useUniverse } from '../hooks/useRelationship'
import { experienceLine, liveCreators } from '../lib/social'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Experience } from '../types'

/** What's etched in the run-out groove: the shows that shaped you. */
export const etchingOf = (xs: Experience[]) =>
  xs
    .filter((x) => x.kind !== 'other')
    .map(experienceLine)
    .join('   ✦   ')
    .toUpperCase()

/** Your identity on CIRCA: the record is the profile. */
export function MyVinyl({ active }: { active: boolean }) {
  const all = useUniverse()
  const lastTop = useStore((s) => s.lastTop)
  const setLastTop = useStore((s) => s.setLastTop)
  const profile = useStore((s) => s.profile)
  const experiences = useStore((s) => s.experiences)
  const favorites = useStore((s) => s.favorites)
  const friends = useStore((s) => s.friends)
  const sheet = useUI((s) => s.sheet)
  const [searching, setSearching] = useState(false)
  const [origin, setOrigin] = useState({ x: 36, y: 36 })

  const live = useMemo(() => liveCreators(experiences), [experiences])
  const markers = useMemo<Marker[]>(
    () =>
      all.map((r) => {
        const c = creatorById[r.creatorId]
        const prev = lastTop[r.creatorId]
        return {
          id: r.creatorId,
          name: c.name,
          avatar: c.avatar,
          top: r.top,
          tier: r.tier.id,
          faint: !r.followed,
          closer: !!prev && prev - r.top > 0.05,
          live: live.has(r.creatorId),
          favorite: favorites.includes(r.creatorId),
        }
      }),
    [all, lastTop, live, favorites],
  )

  // When you leave, remember where everyone was, so moving closer is visible next time.
  const latest = useRef(all)
  useEffect(() => {
    latest.current = all
  }, [all])
  useEffect(() => {
    if (!active) setLastTop(Object.fromEntries(latest.current.map((r) => [r.creatorId, r.top])))
  }, [active, setLastTop])

  const open = (s: Parameters<ReturnType<typeof useUI.getState>['openSheet']>[0]) => useUI.getState().openSheet(s)
  const friendCount = Object.values(friends).filter((f) => f === 'friends').length
  const incoming = Object.values(friends).filter((f) => f === 'incoming').length

  return (
    <section className="screen screen--vinyl" aria-label={brand.vinyl.label}>
      <div className="vinyl-deck">
        <Turntable
          markers={markers}
          owner={{ name: profile.name || 'You', avatar: profile.avatar }}
          etching={etchingOf(experiences)}
          spinning={active && !sheet && !searching}
          controls={
            // the search button, built into the deck
            <button
              className="hifi__search"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const s = e.currentTarget.closest('.screen')!.getBoundingClientRect()
                setOrigin({ x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 })
                setSearching(true)
              }}
              aria-label="Search artists, podcasts and people"
            >
              <span className="hifi__search-cap">
                <I.Search size={18} />
              </span>
              <span className="hifi__search-label" aria-hidden>Search</span>
            </button>
          }
          onMarker={(id) => open({ kind: 'creator', creatorId: id })}
        >
          <div className="plate">
            <div className="plate__id">
              <h1 className="plate__name">{profile.name || 'Your name'}</h1>
              <p className="plate__meta">
                {profile.username && <span>@{profile.username}</span>}
                {profile.location && (
                  <span>
                    <I.Pin size={13} /> {profile.location}
                  </span>
                )}
              </p>
            </div>
            {profile.bio && <p className="plate__bio">{profile.bio}</p>}
            {profile.socials.instagram && (
              <a className="plate__link" href={`https://instagram.com/${profile.socials.instagram}`} target="_blank" rel="noreferrer">
                Instagram · @{profile.socials.instagram}
              </a>
            )}
            {experiences.length > 0 && (
              <ul className="plate__live">
                {experiences.slice(0, 3).map((x) => (
                  <li key={x.id}>
                    <I.Ticket size={15} /> {experienceLine(x)}
                  </li>
                ))}
              </ul>
            )}
            <div className="keys">
              <button className="key" onClick={() => open({ kind: 'friends' })} aria-label={`${friendCount} friends${incoming ? `, ${incoming} new request` : ''}`}>
                <i className={`key__lamp ${incoming ? 'is-on' : ''}`} aria-hidden />
                <span className="key__n">{friendCount}</span>
                <span className="key__label">Friends</span>
              </button>
              <button className="key" onClick={() => open({ kind: 'live' })}>
                <I.Ticket size={18} />
                <span className="key__label">Live</span>
              </button>
              <button className="key" onClick={() => open({ kind: 'profile' })}>
                <I.Edit size={18} />
                <span className="key__label">Edit</span>
              </button>
              <button className="key key--round" onClick={() => open({ kind: 'settings' })} aria-label="Settings">
                <I.Knob size={20} />
              </button>
            </div>
          </div>
        </Turntable>
      </div>
      <Catalog open={searching} onClose={() => setSearching(false)} origin={origin} />
    </section>
  )
}
