import { Mic2, Music2, Play, Tv } from 'lucide-react'
import { creatorById, songs, workByCreator, episodes } from '../data'
import { useRelationship } from '../hooks/useRelationship'
import { formatTime } from '../lib/media'
import { useFollow } from '../screens/InnerCircle'
import { CreatorDetail } from '../screens/YourRecord'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Sheet } from './Sheet'

export function ProfileSheet({ creatorId }: { creatorId: string }) {
  const c = creatorById[creatorId]
  const close = () => useUI.getState().openSheet(null)
  const rel = useRelationship(creatorId)
  const follow = useFollow()
  if (!c || !rel) return null
  const work = workByCreator(creatorId)

  const goToSong = (id: string) => {
    useStore.getState().setArtistsIndex(songs.findIndex((s) => s.id === id))
    close()
    window.location.assign('#artists')
  }
  const goToEpisode = (id: string) => {
    useStore.getState().setPodcastsIndex(episodes.findIndex((e) => e.id === id))
    close()
    window.location.assign('#podcasts')
  }

  return (
    <Sheet title={c.name} onClose={close} wide>
      <div className="profile">
        <div className="profile__hero" style={{ ['--p0' as string]: c.palette[0] ?? 'var(--cherry)', ['--p1' as string]: c.palette[1] ?? 'var(--mustard)' }}>
          <img src={c.avatar} alt="" />
          <div>
            <span className={`kind kind--${c.kind}`}>{c.kind === 'artist' ? <Music2 size={12} /> : <Mic2 size={12} />} {c.kind === 'artist' ? 'Artist' : 'Podcast'}</span>
            <h2>{c.name}</h2>
            <p>{c.genre}{c.location ? ` · ${c.location}` : ''}{c.hosts ? ` · Hosted by ${c.hosts.join(' & ')}` : ''}</p>
          </div>
        </div>
        <p className="profile__bio">{c.bio}</p>
        {c.links && c.links.length > 0 && (
          <p className="profile__links">
            {c.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}
          </p>
        )}

        <div className="profile__rel">
          <CreatorDetail rel={rel} />
        </div>

        <p className="eyebrow">The work</p>
        <ul className="profile__work">
          {work.songs.map((s) => (
            <li key={s.id}>
              <button onClick={() => goToSong(s.id)}>
                <img src={s.artwork} alt="" />
                <span><strong>{s.title}</strong><em>{s.release}{s.duration ? ` · ${formatTime(s.duration)}` : ''}</em></span>
                <Play size={16} />
              </button>
            </li>
          ))}
          {work.episodes.map((e) => (
            <li key={e.id}>
              <button onClick={() => goToEpisode(e.id)}>
                <img src={e.artwork} alt="" />
                <span><strong>{e.title}</strong><em>{e.number ? `Episode ${e.number} · ` : ''}{e.duration ? formatTime(e.duration) : ''}</em></span>
                <Tv size={16} />
              </button>
            </li>
          ))}
        </ul>

        <p className="eyebrow">Inner Circle</p>
        {rel.followed ? (
          <ul className="profile__moments">
            {work.posts.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    close()
                    window.location.assign('#inner-circle')
                  }}
                >
                  {p.poster ? <img src={p.poster} alt="" /> : <span className="profile__moment-ph" />}
                  <span>{p.caption}</span>
                </button>
              </li>
            ))}
            {work.posts.length === 0 && <li className="muted">No Inner Circle moments yet.</li>}
          </ul>
        ) : (
          <div className="locked">
            <p><strong>{work.posts.length} {work.posts.length === 1 ? 'moment' : 'moments'}</strong> for followers only.</p>
            <button className="btn btn--accent" onClick={() => follow(creatorId)}>Follow to see them</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
