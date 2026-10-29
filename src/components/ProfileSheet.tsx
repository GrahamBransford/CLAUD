import { Mic2, Music2, Play, Tv } from 'lucide-react'
import { creatorById, songs, workByCreator } from '../data'
import { affinityFor } from '../lib/affinity'
import { formatTime } from '../lib/media'
import { HandheldCard, useFollow } from '../screens/Handhelds'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Sheet } from './Sheet'

export function ProfileSheet({ creatorId }: { creatorId: string }) {
  const c = creatorById[creatorId]
  const close = () => useUI.getState().openSheet(null)
  const follows = useStore((s) => s.follows)
  const listening = useStore((s) => s.listening)
  const saved = useStore((s) => s.saved)
  const follow = useFollow()
  const work = workByCreator(creatorId)
  const a = affinityFor(creatorId, follows, listening, saved)
  const following = follows.includes(creatorId)

  const goToSong = (id: string) => {
    useStore.getState().setSingersIndex(songs.findIndex((s) => s.id === id))
    close()
    window.location.assign('#singers')
  }

  return (
    <Sheet title={c.name} onClose={close} wide>
      <div className="profile">
        <div className="profile__head" style={{ ['--p0' as string]: c.palette[0], ['--p1' as string]: c.palette[1] }}>
          <img src={c.avatar} alt="" />
          <div>
            <span className={`kind kind--${c.kind}`}>
              {c.kind === 'artist' ? <Music2 size={12} /> : <Mic2 size={12} />} {c.kind === 'artist' ? 'Singer' : 'Speaker'}
            </span>
            <h2>{c.name}</h2>
            <p>{c.genre}{c.location ? ` · ${c.location}` : ''}{c.hosts ? ` · Hosted by ${c.hosts.join(' & ')}` : ''}</p>
          </div>
        </div>
        <button className={`follow-btn follow-btn--lg ${following ? 'is-on' : ''}`} onClick={() => follow(creatorId)}>
          {following ? 'Following' : 'Follow'}
        </button>
        <p className="profile__bio">{c.bio}</p>

        <div className="profile__stats">
          <div><strong>{a.plays}</strong><span>times listened</span></div>
          <div><strong>{Math.round(a.completion * 100)}%</strong><span>finished</span></div>
          <div><strong>{a.saves}</strong><span>saved</span></div>
          <div><strong>{following ? a.score : '—'}</strong><span>circle score</span></div>
        </div>
        <p className="fine">Includes simulated streaming history for the demo.</p>

        <p className="eyebrow">The work</p>
        <ul className="profile__work">
          {work.songs.map((s) => (
            <li key={s.id}>
              <button onClick={() => goToSong(s.id)}>
                <img src={s.cover} alt="" />
                <span><strong>{s.title}</strong><em>{s.release} · {formatTime(s.duration)}</em></span>
                <Play size={16} />
              </button>
            </li>
          ))}
          {work.episodes.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => {
                  close()
                  useUI.getState().openFullEpisode({ episodeId: e.id, startAt: 0, reason: 'library' })
                }}
              >
                <img src={e.art} alt="" />
                <span><strong>{e.title}</strong><em>Episode {e.number} · {formatTime(e.full.duration)}</em></span>
                <Tv size={16} />
              </button>
            </li>
          ))}
        </ul>

        <p className="eyebrow">Handhelds</p>
        {following ? (
          <div className="profile__posts">
            {work.posts.map((p) => (
              <HandheldCard key={p.id} post={p} active />
            ))}
          </div>
        ) : (
          <div className="locked">
            <p><strong>{work.posts.length} {work.posts.length === 1 ? 'Handheld' : 'Handhelds'}</strong> for followers only.</p>
            <button className="btn btn--accent" onClick={() => follow(creatorId)}>Follow to see them</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
