import { Play, Ticket } from 'lucide-react'
import { creatorById, episodes, songs } from '../data'
import { useRelationship } from '../hooks/useRelationship'
import { formatTop } from '../lib/affinity'
import { useFollow } from '../screens/InnerCircle'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Sheet } from './Sheet'
import { RewardCard, TierBadge } from './Tier'

/** Who they are to you: where you stand, what moves you closer. */
export function CreatorSheet({ creatorId }: { creatorId: string }) {
  const c = creatorById[creatorId]
  const rel = useRelationship(creatorId)
  const follow = useFollow()
  const recordConcert = useStore((s) => s.recordConcert)
  const close = () => useUI.getState().openSheet(null)
  if (!c || !rel) return null

  const song = songs.find((s) => s.creatorId === c.id)
  const ep = episodes.find((e) => e.creatorId === c.id)
  const listen = () => {
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

  return (
    <Sheet label={c.name} onClose={close}>
      <div className={`creator ${rel.tier.id === 'top1' ? 'creator--top' : ''}`}>
        <div className="creator__head">
          <img src={c.avatar} alt="" />
          <div>
            <h2>{c.name}</h2>
            <p>{c.genre}</p>
          </div>
        </div>

        <div className="creator__standing">
          <TierBadge tier={rel.tier.id} />
          <div>
            <p className="creator__top">{rel.points > 0 ? formatTop(rel.top) : 'New'}</p>
            <p className="creator__of">{rel.points > 0 ? `of ${c.name}’s listeners · estimate` : 'on the edge of your record'}</p>
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
            <button className="pill pill--cherry" onClick={listen}><Play size={15} fill="currentColor" /> Listen</button>
          )}
          <button className={`pill ${rel.followed ? 'pill--quiet' : 'pill--light'}`} onClick={() => follow(c.id)}>
            {rel.followed ? 'Following' : 'Follow'}
          </button>
          <button
            className="pill pill--quiet"
            onClick={() => {
              recordConcert(c.id)
              useUI.getState().pushToast({ image: c.avatar, title: c.kind === 'artist' ? 'Show added' : 'Live taping added', detail: 'Demo check-in' })
            }}
          >
            <Ticket size={15} /> {c.kind === 'artist' ? 'Went to a show' : 'Went to a taping'}
          </button>
        </div>

        <RewardCard rel={rel} />
      </div>
    </Sheet>
  )
}
