import { useState } from 'react'
import { creatorById, creatorVinylById, episodes, songs } from '../data'
import { useProfile } from '../hooks/useProfile'
import { useRelationship } from '../hooks/useRelationship'
import { fmtMinutes, type Owner } from '../lib/profile'
import { followerCount, fmtCount } from '../lib/creators'
import { formatTop } from '../lib/affinity'
import { topListeners } from '../lib/social'
import { useFollow } from '../screens/InnerCircle'
import { radioIndexOf } from '../lib/radio'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import * as I from './Icons'
import { Sheet } from './Sheet'
import { RewardCard, TierBadge } from './Tier'
import { useCreatorCommunities } from './Communities'

/**
 * A creator, seen from whichever vinyl you tapped them on: that listener's
 * minutes, full listens, most played, how long they've followed, shows,
 * recent activity and standing. On your own vinyl, that listener is you.
 */
export function CreatorSheet({ creatorId, owner = 'me' }: { creatorId: string; owner?: Owner }) {
  const c = creatorById[creatorId]
  const rel = useRelationship(creatorId)
  const profile = useProfile(owner)
  const com = useCreatorCommunities(creatorId)
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
      useStore.getState().setRadioIndex(Math.max(0, radioIndexOf(ep.id)))
      window.location.hash = 'radio'
    }
  }
  const st = profile ? [...profile.artists, ...profile.podcasts].find((x) => x.creatorId === c.id) : undefined
  const mine = owner === 'me'
  const whose = mine ? 'Your' : `${profile?.who ?? 'Their'}’s`
  const progress = rel.next ? Math.max(4, Math.min(96, 100 - (rel.next.pointsNeeded / (rel.points + rel.next.pointsNeeded)) * 100)) : 100
  const listeners = topListeners(c.id)

  return (
    <Sheet label={c.name} onClose={close}>
      <div className={`creator ${rel.tier.id === 'top1' ? 'creator--top' : ''}`}>
        <div className="creator__head">
          <img src={c.avatar} alt="" />
          <div>
            <h2>{c.name}</h2>
            <p>
              {c.genre} · {fmtCount(followerCount(c.id, rel.followed))} followers
            </p>
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

        {!mine && <p className="creator__whose">On {profile?.who}’s vinyl</p>}
        <div className="creator__standing">
          <TierBadge tier={(st ?? rel).tier.id} />
          <div>
            <p className="creator__top">{(st?.points ?? rel.points) > 0 ? formatTop((st ?? rel).top) : 'New'}</p>
            <p className="creator__of">
              {(st?.points ?? rel.points) > 0 ? `of ${c.name}’s listeners · estimate` : 'on the edge of your vinyl'}
            </p>
            <p className="creator__level">{(st ?? rel).tier.label}: {(st ?? rel).tier.line.replace('You keep', mine ? 'You keep' : 'Keeps').replace('Part of your', mine ? 'Part of your' : 'Part of their')}</p>
          </div>
        </div>

        {mine && rel.next && (
          <div className="creator__next">
            <span className="creator__bar"><i style={{ width: `${progress}%` }} /></span>
            <p>{rel.next.tier.label} in {rel.next.hint}</p>
          </div>
        )}

        {st && (
          <>
            <p className="settings__label">{whose} listening</p>
            <dl className="cstats">
              <div>
                <dt>Minutes listened</dt>
                <dd>{fmtMinutes(st.minutes)}</dd>
              </div>
              <div>
                <dt>{c.kind === 'podcast' ? 'Episodes finished' : 'Songs heard in full'}</dt>
                <dd>{st.completions}</dd>
              </div>
              <div className="cstats__wide">
                <dt>Most played</dt>
                <dd>{st.mostPlayed ? <>“{st.mostPlayed.title}” <em>{st.mostPlayed.plays} plays</em></> : '—'}</dd>
              </div>
              <div>
                <dt>Following since</dt>
                <dd>{st.followedSince ?? 'Not following'}</dd>
              </div>
              <div>
                <dt>{c.kind === 'podcast' ? 'Live tapings' : 'Shows attended'}</dt>
                <dd>{st.shows}</dd>
              </div>
            </dl>
            {st.recent.length > 0 && (
              <>
                <p className="settings__label">Recently</p>
                <ul className="recent">
                  {st.recent.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {!mine && rel.points > 0 && (
          <p className="creator__you">
            You: {formatTop(rel.top)} · {rel.tier.label}
          </p>
        )}

        <div className="creator__actions">
          {(song || ep) && (
            <button className="pill pill--cherry" onClick={listen}><I.Play size={15} /> Listen</button>
          )}
          {creatorVinylById[c.id] && (
            <button className="pill pill--quiet" onClick={() => useUI.getState().openPerson(`creator:${c.id}`)}>
              <span className="pill__disc" aria-hidden /> Their vinyl
            </button>
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

        {com.count > 0 && (
          <button className="row-link" onClick={() => useUI.getState().openSheet({ kind: 'communities', creatorId: c.id })}>
            <I.People size={18} />
            <span>
              <strong>Communities</strong>
              <em>
                {com.count} {com.count === 1 ? 'community' : 'communities'}
                {com.near ? ` · ${com.near} near you` : ''}
              </em>
            </span>
            <I.Down size={16} />
          </button>
        )}
        {mine && <RewardCard rel={rel} />}

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
