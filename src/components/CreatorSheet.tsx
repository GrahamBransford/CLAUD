import { useState } from 'react'
import { creatorById, episodes, songs } from '../data'
import { useRelationship } from '../hooks/useRelationship'
import { formatTop } from '../lib/affinity'
import { topListeners } from '../lib/social'
import { useFollow } from '../screens/InnerCircle'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import * as I from './Icons'
import { Sheet } from './Sheet'
import { RewardCard, TierBadge } from './Tier'

/** A creator's profile: where you stand, what moves you closer, and who else loves them. */
export function CreatorSheet({ creatorId }: { creatorId: string }) {
  const c = creatorById[creatorId]
  const rel = useRelationship(creatorId)
  const follow = useFollow()
  const addExperience = useStore((s) => s.addExperience)
  const favorite = useStore((s) => s.favorites.includes(creatorId))
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const friends = useStore((s) => s.friends)
  const [fans, setFans] = useState(false)
  const close = () => useUI.getState().openSheet(null)
  if (!c || !rel) return null

  const song = songs.find((s) => s.creatorId === c.id)
  const ep = episodes.find((e) => e.creatorId === c.id)
  const listen = () => {
    useUI.getState().openPerson(null)
    close()
    if (song) {
      useStore.getState().setArtistsIndex(songs.indexOf(song))
      window.location.hash = 'artists'
    } else if (ep) {
      useStore.getState().setPodcastsIndex(episodes.indexOf(ep))
      window.location.hash = 'podcasts'
    }
  }
  const s = rel.signals
  const progress = rel.next ? Math.max(4, Math.min(96, 100 - (rel.next.pointsNeeded / (rel.points + rel.next.pointsNeeded)) * 100)) : 100
  const listeners = topListeners(c.id)

  return (
    <Sheet label={c.name} onClose={close}>
      <div className={`creator ${rel.tier.id === 'top1' ? 'creator--top' : ''}`}>
        <div className="creator__head">
          <img src={c.avatar} alt="" />
          <div>
            <h2>{c.name}</h2>
            <p>{c.genre}</p>
          </div>
          <button
            className={`creator__fav ${favorite ? 'is-on' : ''}`}
            onClick={() => toggleFavorite(c.id)}
            aria-pressed={favorite}
            aria-label={favorite ? 'Favourite' : 'Mark as favourite'}
          >
            <I.Spark size={22} on={favorite} />
          </button>
        </div>

        <div className="creator__standing">
          <TierBadge tier={rel.tier.id} />
          <div>
            <p className="creator__top">{rel.points > 0 ? formatTop(rel.top) : 'New'}</p>
            <p className="creator__of">{rel.points > 0 ? `of ${c.name}’s listeners · estimate` : 'on the edge of your vinyl'}</p>
          </div>
        </div>

        {rel.next && (
          <div className="creator__next">
            <span className="creator__bar"><i style={{ width: `${progress}%` }} /></span>
            <p>{rel.next.tier.label} in {rel.next.hint}</p>
          </div>
        )}

        <p className="creator__stats">
          {Math.round(s.minutes)} min · {s.completions} full {c.kind === 'podcast' ? 'episodes' : 'listens'}
          {s.concerts ? ` · ${s.concerts} ${s.concerts === 1 ? 'show' : 'shows'}` : ''}
        </p>

        <div className="creator__actions">
          {(song || ep) && (
            <button className="pill pill--cherry" onClick={listen}><I.Play size={15} /> Listen</button>
          )}
          <button className={`pill ${rel.followed ? 'pill--quiet' : 'pill--light'}`} onClick={() => follow(c.id)}>
            {rel.followed ? 'Following' : 'Follow'}
          </button>
          <button
            className="pill pill--quiet"
            onClick={() => {
              addExperience({ kind: c.kind === 'artist' ? 'concert' : 'performance', creatorId: c.id, title: c.name, year: new Date().getFullYear() })
              useUI.getState().pushToast({ image: c.avatar, title: c.kind === 'artist' ? 'Show added to your vinyl' : 'Live taping added to your vinyl', detail: 'Self-reported' })
            }}
          >
            <I.Ticket size={16} /> {c.kind === 'artist' ? 'Went to a show' : 'Went to a taping'}
          </button>
        </div>

        <RewardCard rel={rel} />

        {listeners.length > 0 && (
          <div className="fans">
            <button className="fans__toggle" onClick={() => setFans(!fans)} aria-expanded={fans}>
              <span className="match__faces">
                {listeners.slice(0, 3).map((l) => <img key={l.person.id} src={l.person.avatar} alt="" />)}
              </span>
              See top listeners
              <span className="fans__demo">Demo</span>
            </button>
            {fans && (
              <ol className="fans__list">
                {listeners.map((l) => (
                  <li key={l.person.id}>
                    <button className="person-row person-row__who" onClick={() => useUI.getState().openPerson(l.person.id)}>
                      <span className="minidisc"><img src={l.person.avatar} alt="" /></span>
                      <span className="hit__text">
                        <strong>{l.person.name}</strong>
                        <em>{formatTop(l.top)} of listeners{friends[l.person.id] === 'friends' ? ' · friend' : ''}</em>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
