import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { creatorById, personById } from '../data'
import { useAlignment, useFriendActions, usePersonMarkers } from '../hooks/useSocial'
import { mutualFriends } from '../lib/social'
import { etchingOf } from '../screens/MyVinyl'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Person } from '../types'
import * as I from './Icons'
import { Turntable } from './Turntable'

const EASE = [0.22, 0.7, 0.18, 1] as const

/** Someone else's vinyl: being invited to look through their records. */
export function PersonVinyl({ id }: { id: string }) {
  const p = personById[id]
  const markers = usePersonMarkers(p)
  const sheet = useUI((s) => s.sheet)
  const close = () => useUI.getState().openPerson(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !useUI.getState().sheet && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!p) return null
  return (
    <motion.div
      className="person"
      role="dialog"
      aria-label={`${p.name}'s vinyl`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.32, ease: EASE } }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.22 } }}
    >
      <div className="person__bar">
        <button className="icon-btn" onClick={close} aria-label="Close">
          <I.Down size={26} />
        </button>
        <span className="person__handle">@{p.username}</span>
        <span className="icon-btn" aria-hidden />
      </div>
      <div className="vinyl-deck">
        <Turntable
          markers={markers}
          owner={{ name: p.name, avatar: p.avatar }}
          etching={etchingOf(p.experiences)}
          spinning={!sheet}
          className="hifi--guest"
          onMarker={(cid) => useUI.getState().openSheet({ kind: 'creator', creatorId: cid })}
        >
          <div className="plate">
            <div className="plate__id">
              <h1 className="plate__name">{p.name}</h1>
              {p.location && (
                <p className="plate__meta">
                  <span>
                    <I.Pin size={13} /> {p.location}
                  </span>
                </p>
              )}
            </div>
            <p className="plate__bio">{p.bio}</p>
            <Friendship person={p} />
            <Match person={p} />
            {p.socials?.instagram && (
              <a className="plate__link" href={`https://instagram.com/${p.socials.instagram}`} target="_blank" rel="noreferrer">
                Instagram · @{p.socials.instagram}
              </a>
            )}
          </div>
        </Turntable>
      </div>
    </motion.div>
  )
}

/** Shared taste, read off a VU meter. */
function Match({ person }: { person: Person }) {
  const al = useAlignment(person)
  if (!al) return null
  const angle = -48 + (al.score / 100) * 96
  const names = al.shared.slice(0, 4).map((id) => creatorById[id]).filter(Boolean)
  return (
    <div className="match">
      <svg className="vu" viewBox="0 0 120 70" aria-hidden>
        <rect x="1" y="1" width="118" height="68" rx="7" className="vu__face" />
        {Array.from({ length: 11 }, (_, k) => {
          const a = ((-48 + k * 9.6) * Math.PI) / 180
          const r1 = k % 5 === 0 ? 40 : 43
          return <line key={k} x1={60 + Math.sin(a) * r1} y1={64 - Math.cos(a) * r1} x2={60 + Math.sin(a) * 47} y2={64 - Math.cos(a) * 47} className={k >= 8 ? 'vu__tick vu__tick--hot' : 'vu__tick'} />
        })}
        <path d="M 82.6 22.8 A 47 47 0 0 1 94.9 32.6" className="vu__hot" />
        <text x="60" y="54" className="vu__label">TASTE</text>
        <motion.g initial={{ rotate: -48 }} animate={{ rotate: angle, transition: { duration: 1.1, ease: [0.3, 1.25, 0.5, 1], delay: 0.25 } }} style={{ originX: '60px', originY: '64px' }}>
          <line x1="60" y1="64" x2="60" y2="20" className="vu__needle" />
        </motion.g>
        <circle cx="60" cy="64" r="4" className="vu__pivot" />
      </svg>
      <div className="match__text">
        <p className="match__score">
          <strong>{al.score}%</strong> musically aligned
        </p>
        <p className="match__fine">Estimated from listening on CIRCA · demo</p>
      </div>
      <div className="match__more">
        {names.length > 0 && (
          <div className="match__shared">
            <span className="match__faces">
              {names.map((c) => (
                <img key={c.id} src={c.avatar} alt="" title={c.name} />
              ))}
            </span>
            <span>
              You both love {names.slice(0, 2).map((c) => c.name).join(' and ')}
              {al.shared.length > 2 ? ` +${al.shared.length - 2}` : ''}
            </span>
          </div>
        )}
        {al.sharedLive.length > 0 && (
          <p className="match__live">
            <I.Ticket size={15} /> You both saw {al.sharedLive.map((id) => creatorById[id]?.name).join(' and ')} live
          </p>
        )}
      </div>
    </div>
  )
}

/** Friends see each other's vinyl. There is no messaging: socials are on the plate. */
function Friendship({ person }: { person: Person }) {
  const friends = useStore((s) => s.friends)
  const vinylFollows = useStore((s) => s.vinylFollows)
  const toggleVinylFollow = useStore((s) => s.toggleVinylFollow)
  const act = useFriendActions()
  const [confirm, setConfirm] = useState(false)
  const state = friends[person.id]
  const mutual = mutualFriends(person, friends).map((id) => personById[id]).filter(Boolean)
  return (
    <>
      <div className="keys">
        {!state && (
          <button className="key key--primary" onClick={() => act.request(person.id)}>
            <I.AddPerson size={18} />
            <span className="key__label">Add friend</span>
          </button>
        )}
        {state === 'outgoing' && (
          <button className="key" onClick={() => act.cancel(person.id)}>
            <i className="key__lamp is-on" aria-hidden />
            <span className="key__label">Requested</span>
          </button>
        )}
        {state === 'incoming' && (
          <>
            <button className="key key--primary" onClick={() => act.accept(person.id)}>
              <I.Check size={18} />
              <span className="key__label">Accept</span>
            </button>
            <button className="key" onClick={() => act.decline(person.id)}>
              <span className="key__label">Decline</span>
            </button>
          </>
        )}
        {state === 'friends' && (
          <>
            {confirm ? (
              <button className="key key--warn" onClick={() => act.remove(person.id)} onBlur={() => setConfirm(false)} autoFocus>
                <span className="key__label">Remove friend</span>
              </button>
            ) : (
              <button className="key is-down" onClick={() => setConfirm(true)} aria-label={`Friends with ${person.name}`}>
                <I.Check size={18} />
                <span className="key__label">Friends</span>
              </button>
            )}
            <button className="key" onClick={() => toggleVinylFollow(person.id)} aria-pressed={vinylFollows.includes(person.id)}>
              <i className={`key__lamp ${vinylFollows.includes(person.id) ? 'is-on' : ''}`} aria-hidden />
              <span className="key__label">Updates</span>
            </button>
          </>
        )}
      </div>
      {mutual.length > 0 && (
        <button className="mutual" onClick={() => useUI.getState().openPerson(mutual[0].id)}>
          <span className="match__faces">
            {mutual.map((m) => (
              <img key={m.id} src={m.avatar} alt="" />
            ))}
          </span>
          {mutual.length} mutual {mutual.length === 1 ? 'friend' : 'friends'} · {mutual.map((m) => m.name.split(' ')[0]).join(', ')}
        </button>
      )}
    </>
  )
}
