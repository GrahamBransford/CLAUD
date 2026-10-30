import { useState } from 'react'
import { creatorById } from '../data'
import { formatTop, type Relationship } from '../lib/affinity'
import { liveCreators } from '../lib/social'
import { useUI } from '../store/useUI'
import type { Experience } from '../types'

/**
 * Your year in listening, except it's every day: the readouts on the deck,
 * backlit like the meter windows on a hi-fi. Everything here comes from what
 * CIRCA already knows (in the demo, a simulated history plus what you do).
 */
export function Readouts({ rels, experiences }: { rels: Relationship[]; experiences: Experience[] }) {
  const [today] = useState(() => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
  const open = (id: string) => useUI.getState().openSheet({ kind: 'creator', creatorId: id })
  const minutes = Math.round(rels.reduce((n, r) => n + r.signals.minutes, 0))
  const byKind = (k: 'artist' | 'podcast') => rels.filter((r) => creatorById[r.creatorId]?.kind === k).sort((a, b) => a.top - b.top)[0]
  const artist = byKind('artist')
  const podcast = byKind('podcast')

  // your sound: the genre carrying the most of your listening
  const genres = new Map<string, number>()
  for (const r of rels) {
    const g = creatorById[r.creatorId]?.genre
    if (g) genres.set(g, (genres.get(g) ?? 0) + r.points)
  }
  const total = [...genres.values()].reduce((a, b) => a + b, 0) || 1
  const [sound, soundPts] = [...genres.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['—', 0]

  const live = liveCreators(experiences)
  const shows = experiences.filter((x) => x.kind !== 'other').length
  const newest = rels.filter((r) => r.tier.id === 'discovered').sort((a, b) => b.points - a.points)[0]

  return (
    <section className="readouts" aria-label="Your listening, updated daily">
      <p className="readouts__head">
        <span>Today</span>
        <span>Updated {today} · demo</span>
      </p>
      <div className="readouts__row">
        <div className="readout readout--counter">
          <span className="readout__label">Minutes</span>
          <span className="readout__counter" aria-label={`${minutes} minutes`}>
            {String(Math.min(99999, minutes)).padStart(5, '0').split('').map((d, i) => (
              <i key={i}>{d}</i>
            ))}
          </span>
        </div>
        {artist && (
          <button className="readout" onClick={() => open(artist.creatorId)}>
            <span className="readout__label">Top artist</span>
            <span className="readout__who">
              <img src={creatorById[artist.creatorId].avatar} alt="" />
              <strong>{creatorById[artist.creatorId].name}</strong>
            </span>
            <span className="readout__sub">{formatTop(artist.top)} of listeners</span>
          </button>
        )}
        {podcast && (
          <button className="readout" onClick={() => open(podcast.creatorId)}>
            <span className="readout__label">Top podcast</span>
            <span className="readout__who">
              <img src={creatorById[podcast.creatorId].avatar} alt="" />
              <strong>{creatorById[podcast.creatorId].name}</strong>
            </span>
            <span className="readout__sub">{formatTop(podcast.top)} of listeners</span>
          </button>
        )}
        <div className="readout">
          <span className="readout__label">Your sound</span>
          <strong className="readout__big">{sound}</strong>
          <span className="readout__sub">{Math.round((soundPts / total) * 100)}% of your listening</span>
        </div>
        <div className="readout">
          <span className="readout__label">Seen live</span>
          <strong className="readout__big">
            {shows} {shows === 1 ? 'show' : 'shows'}
          </strong>
          <span className="readout__sub">{live.size ? [...live].map((id) => creatorById[id]?.name).filter(Boolean).slice(0, 2).join(', ') : 'Add one under Live'}</span>
        </div>
        {newest && (
          <button className="readout" onClick={() => open(newest.creatorId)}>
            <span className="readout__label">Newest find</span>
            <span className="readout__who">
              <img src={creatorById[newest.creatorId].avatar} alt="" />
              <strong>{creatorById[newest.creatorId].name}</strong>
            </span>
            <span className="readout__sub">On the edge of your vinyl</span>
          </button>
        )}
      </div>
    </section>
  )
}
