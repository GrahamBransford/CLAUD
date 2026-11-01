import { useState } from 'react'
import { creatorById } from '../data'
import { formatTop } from '../lib/affinity'
import type { ListeningProfile } from '../lib/profile'
import { useUI, type DetailTab } from '../store/useUI'

/**
 * The readouts on the deck, backlit like a hi-fi's meter windows: listening
 * time, top artist and podcast, the sound, shows lived and the newest find.
 * Every window opens onto the full story behind it.
 */
export function Readouts({ profile }: { profile: ListeningProfile }) {
  const [today] = useState(() => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
  const owner = profile.owner
  const details = (tab: DetailTab) => useUI.getState().openSheet({ kind: 'details', owner, tab })
  const creator = (id: string) => useUI.getState().openSheet({ kind: 'creator', creatorId: id, owner })
  const artist = profile.artists[0]
  const podcast = profile.podcasts[0]
  const sound = profile.genres[0]
  const shows = profile.experiences.filter((x) => x.kind !== 'other')
  const newest = [...profile.artists, ...profile.podcasts].filter((s) => s.tier.id === 'discovered').sort((a, b) => b.points - a.points)[0]
  const me = owner === 'me'
  const minutes = profile.minutes.all

  return (
    <section className="readouts" aria-label="Listening, updated daily">
      <p className="readouts__head">
        <span>{me ? 'Today' : 'Their listening'}</span>
        <span>{today} · demo</span>
      </p>
      <div className="readouts__row">
        <button className="readout readout--counter" onClick={() => details('listening')}>
          <span className="readout__label">Minutes</span>
          <span className="readout__counter" aria-label={`${minutes} minutes`}>
            {String(Math.min(99999, minutes)).padStart(5, '0').split('').map((d, i) => (
              <i key={i}>{d}</i>
            ))}
          </span>
          <span className="readout__sub">{profile.minutes.week.toLocaleString()} this week</span>
        </button>
        {artist && (
          <button className="readout" onClick={() => details('artists')}>
            <span className="readout__label">Top artist</span>
            <span className="readout__who">
              <img src={creatorById[artist.creatorId].avatar} alt="" />
              <strong>{creatorById[artist.creatorId].name}</strong>
            </span>
            <span className="readout__sub">{formatTop(artist.top)} of fans</span>
          </button>
        )}
        {podcast && (
          <button className="readout" onClick={() => details('podcasts')}>
            <span className="readout__label">Top podcast</span>
            <span className="readout__who">
              <img src={creatorById[podcast.creatorId].avatar} alt="" />
              <strong>{creatorById[podcast.creatorId].name}</strong>
            </span>
            <span className="readout__sub">{formatTop(podcast.top)} of fans</span>
          </button>
        )}
        {sound && (
          <button className="readout" onClick={() => details('genres')}>
            <span className="readout__label">{me ? 'Your sound' : 'Their sound'}</span>
            <strong className="readout__big">{sound.genre}</strong>
            <span className="readout__sub">{Math.round(sound.share * 100)}% of the music</span>
          </button>
        )}
        <button className="readout" onClick={() => details('live')}>
          <span className="readout__label">Seen live</span>
          <strong className="readout__big">
            {shows.length} {shows.length === 1 ? 'show' : 'shows'}
          </strong>
          <span className="readout__sub">
            {shows.length ? [...new Set(shows.map((x) => (x.creatorId ? creatorById[x.creatorId]?.name : x.title)))].filter(Boolean).slice(0, 2).join(', ') : me ? 'Add one under Live' : 'None added yet'}
          </span>
        </button>
        {newest && (
          <button className="readout" onClick={() => creator(newest.creatorId)}>
            <span className="readout__label">Newest find</span>
            <span className="readout__who">
              <img src={creatorById[newest.creatorId].avatar} alt="" />
              <strong>{creatorById[newest.creatorId].name}</strong>
            </span>
            <span className="readout__sub">At the edge of the vinyl</span>
          </button>
        )}
      </div>
    </section>
  )
}
