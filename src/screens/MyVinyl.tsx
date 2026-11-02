import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { brand } from '../config/brand'
import { Awards } from '../components/Awards'
import { creatorById, meSeed } from '../data'
import * as I from '../components/Icons'
import { Catalog } from '../components/Catalog'
import { RecordC } from '../components/Logo'
import { Readouts } from '../components/Readouts'
import { Turntable, type Marker } from '../components/Turntable'
import { useProfile } from '../hooks/useProfile'
import { ON_RECORD } from '../lib/profile'
import { useUpdates } from '../hooks/useUpdates'
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
  const profileData = useProfile('me')
  const updates = useUpdates()
  const lastTop = useStore((s) => s.lastTop)
  const setLastTop = useStore((s) => s.setLastTop)
  const profile = useStore((s) => s.profile)
  const experiences = useStore((s) => s.experiences)
  const favorites = useStore((s) => s.favorites)
  const omitVinyl = useStore((s) => s.omitVinyl)
  const friends = useStore((s) => s.friends)
  const sheet = useUI((s) => s.sheet)
  const [searching, setSearching] = useState(false)
  const [origin, setOrigin] = useState({ x: 36, y: 36 })
  const search = useRef<HTMLButtonElement>(null)

  // Publish where the search button sits, so the feeds' C can sit in exactly the same place.
  useLayoutEffect(() => {
    const el = search.current
    if (!el) return
    const root = document.documentElement.style
    const place = () => {
      // measured against the page itself, so a page mid-slide doesn't skew it
      const stage = el.closest('.view')?.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      if (!stage || window.innerWidth >= 900 || !r.width) return
      root.setProperty('--corner-x', `${(r.left + r.width / 2 - stage.left).toFixed(1)}px`)
      root.setProperty('--corner-y', `${(r.top + r.height / 2 - stage.top).toFixed(1)}px`)
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el.closest('.hifi') ?? el)
    window.addEventListener('resize', place)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [])

  const live = useMemo(() => liveCreators(experiences), [experiences])
  const markers = useMemo<Marker[]>(
    () =>
      // the twelve closest sit on the record; everyone else is in the lists behind the readouts
      // anyone you've left off your vinyl isn't on the record (or seen by anyone who opens it)
      all
        .filter((r) => !(omitVinyl ?? []).includes(r.creatorId))
        .slice(0, ON_RECORD)
        .map((r) => {
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
    [all, lastTop, live, favorites, omitVinyl],
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
            <>
            {/* the search button, built into the deck */}
            <button
              ref={search}
              className="hifi__search"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const s = e.currentTarget.closest('.screen')!.getBoundingClientRect()
                setOrigin({ x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 })
                setSearching(true)
              }}
              aria-label="Search artists, podcasts and people"
            >
              <span className="knob__cap">
                <I.Search size={18} />
              </span>
            </button>
            {/* the C, set into the tonearm's pivot: your account and settings */}
            <button className="hifi__settings" onClick={() => open({ kind: 'settings' })} aria-label="Settings and your account">
              <RecordC spinning={active && !sheet && !searching} />
            </button>
          </>
          }
          onMarker={(id) => open({ kind: 'creator', creatorId: id })}
          onLabel={() => open({ kind: 'profile' })}
          labelHint="Your vinyl: edit your profile, favourites, and who's on it"
        >
          <div className="plate">
            {/* the fascia: a knob either side of your nameplate, like the radio's tuning and volume */}
            <div className="plate__fascia">
            <Knob label={`Friends: ${friendCount}${incoming ? `, ${incoming} new request` : ''}${updates.unseen ? `, ${updates.unseen} new updates` : ''}`} lamp={incoming > 0 || updates.unseen > 0} onClick={() => open({ kind: 'friends' })}>
              <I.People size={18} />
            </Knob>
            <div className="plate__id">
              <h1 className="plate__name">{profile.name || 'Your name'}</h1>
              <p className="plate__meta">
                {profile.username && <span>@{profile.username}</span>}
                {profile.location && (
                  <span>
                    <I.Pin size={13} /> {profile.location}
                  </span>
                )}
                {profile.socials.instagram && (
                  <a className="plate__link" aria-label={`Instagram: ${profile.socials.instagram}`} href={`https://instagram.com/${profile.socials.instagram}`} target="_blank" rel="noreferrer">
                    <I.Instagram size={14} />
                    <span>{profile.socials.instagram}</span>
                  </a>
                )}
              </p>
            </div>
            <Knob label="Live: shows and experiences" onClick={() => open({ kind: 'live' })}>
              <I.Ticket size={18} />
            </Knob>
            </div>
            {profile.bio && <p className="plate__bio">{profile.bio}</p>}
            <Awards list={meSeed.awards} />
            {profileData && <Readouts profile={profileData} />}
          </div>
        </Turntable>
      </div>
      <Catalog open={searching} onClose={() => setSearching(false)} origin={origin} />
    </section>
  )
}

/** A machined knob on the cabinet front, its symbol engraved in the face. */
export function Knob({ label, lamp, onClick, children }: { label: string; lamp?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="knob" onClick={onClick} aria-label={label} title={label.split(':')[0]}>
      <span className="knob__cap" aria-hidden>{children}</span>
      {lamp && <i className="knob__lamp" aria-hidden />}
    </button>
  )
}
