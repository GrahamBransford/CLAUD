import { motion } from 'framer-motion'
import { Info, Mic2, Music2, Play, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { creatorById, creators, posts } from '../data'
import { rankCircle, rankHandhelds, type Affinity } from '../lib/affinity'
import { claimAudioFocus, formatTime, relativeHours } from '../lib/media'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { HandheldPost } from '../types'

export function useFollow() {
  const toggle = useStore((s) => s.toggleFollow)
  const pushToast = useUI((s) => s.pushToast)
  return (creatorId: string) => {
    const now = toggle(creatorId)
    const c = creatorById[creatorId]
    pushToast({
      tone: 'follow',
      image: c.avatar,
      title: now ? `Following ${c.name}` : `Unfollowed ${c.name}`,
      detail: now ? 'Their Handhelds now appear in your feed.' : 'Their posts have left your feed.',
    })
  }
}

export function Handhelds({ active }: { active: boolean }) {
  const follows = useStore((s) => s.follows)
  const listening = useStore((s) => s.listening)
  const saved = useStore((s) => s.saved)
  const openSheet = useUI((s) => s.openSheet)
  const feed = useMemo(() => rankHandhelds(follows, listening, saved), [follows, listening, saved])
  const circle = useMemo(() => rankCircle(follows, listening, saved), [follows, listening, saved])
  const outside = creators.filter((c) => !follows.includes(c.id) && posts.some((p) => p.creatorId === c.id))

  return (
    <section className="handhelds" aria-label="Handhelds — behind the work">
      <header className="handhelds__masthead">
        <div>
          <p className="eyebrow">Handhelds</p>
          <h1>Unpolished, unreleased, up close.</h1>
          <p className="handhelds__dek">
            Phone-in-hand moments from the singers and speakers you follow. No ads, no strangers, no endless scroll —
            ordered by whose work you actually listen to.
          </p>
        </div>
        <button className="chip-btn" onClick={() => openSheet({ kind: 'tuning' })}>
          <Info size={16} /> <span>How this is ordered</span>
        </button>
      </header>

      <div className="handhelds__layout">
        <aside className="circle" aria-label="Your circle">
          <p className="eyebrow">Your circle · {circle.length}</p>
          <ol>
            {circle.map((a, i) => (
              <CircleRow key={a.creatorId} a={a} rank={i + 1} />
            ))}
          </ol>
          {circle.length === 0 && <p className="muted">Follow a singer or speaker to start your circle.</p>}
        </aside>

        <div className="feed">
          {feed.length === 0 && (
            <div className="empty">
              <div className="empty__art" aria-hidden><span /></div>
              <h2>Your Handhelds are quiet.</h2>
              <p>Follow the singers and speakers you discover, and their behind-the-scenes moments will show up here.</p>
            </div>
          )}
          {feed.map(({ post, affinity }) => (
            <HandheldCard key={post.id} post={post} affinity={affinity} active={active} />
          ))}
          {feed.length > 0 && (
            <div className="caught-up">
              <span className="caught-up__rule" />
              <p><strong>You&rsquo;re all caught up.</strong> That&rsquo;s everything from your circle. Go listen to something.</p>
            </div>
          )}
          {outside.length > 0 && (
            <div className="outside">
              <p className="eyebrow">Not in your circle yet</p>
              <p className="muted">Their Handhelds stay private to their followers. Follow to let them in.</p>
              <ul>
                {outside.map((c) => (
                  <OutsideRow key={c.id} id={c.id} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function CircleRow({ a, rank }: { a: Affinity; rank: number }) {
  const c = creatorById[a.creatorId]
  return (
    <motion.li layout transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
      <button onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: c.id })}>
        <span className="circle__rank">{rank}</span>
        <img src={c.avatar} alt="" />
        <span className="circle__name">
          <strong>{c.name}</strong>
          <span className="meter" aria-label={`Affinity ${a.score} of 100`}>
            <span style={{ width: `${a.score}%` }} />
          </span>
        </span>
        <span className="circle__score">{a.score}</span>
      </button>
    </motion.li>
  )
}

function OutsideRow({ id }: { id: string }) {
  const c = creatorById[id]
  const follow = useFollow()
  return (
    <li>
      <button className="outside__who" onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: id })}>
        <img src={c.avatar} alt="" />
        <span><strong>{c.name}</strong><em>{c.kind === 'artist' ? 'Singer' : 'Speaker'} · {c.genre}</em></span>
      </button>
      <button className="follow-btn" onClick={() => follow(id)}>Follow</button>
    </li>
  )
}

export function HandheldCard({ post, affinity, active }: { post: HandheldPost; affinity?: Affinity; active: boolean }) {
  const c = creatorById[post.creatorId]
  const follows = useStore((s) => s.follows)
  const follow = useFollow()
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)

  useEffect(() => {
    if (!active) ref.current?.pause()
  }, [active])

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) {
      claimAudioFocus(v)
      void v.play()
    } else v.pause()
  }

  return (
    <motion.article className="handheld" layout transition={{ type: 'spring', stiffness: 300, damping: 34 }}>
      <header className="handheld__head">
        <button className="handheld__who" onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: c.id })}>
          <img src={c.avatar} alt="" />
          <span>
            <strong>{c.name}</strong>
            <em>
              <span className={`kind kind--${c.kind}`}>
                {c.kind === 'artist' ? <Music2 size={11} /> : <Mic2 size={11} />} {c.kind === 'artist' ? 'Singer' : 'Speaker'}
              </span>
              {' '}· {post.context} · {relativeHours(post.postedHoursAgo)}
            </em>
          </span>
        </button>
        <button className={`follow-btn ${follows.includes(c.id) ? 'is-on' : ''}`} onClick={() => follow(c.id)}>
          {follows.includes(c.id) ? 'Following' : 'Follow'}
        </button>
      </header>

      <div className={`handheld__media handheld__media--${post.type}`}>
        {post.type === 'video' ? (
          <>
            <video
              ref={ref}
              src={post.src}
              poster={post.poster}
              playsInline
              preload="metadata"
              loop={false}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
              onClick={toggle}
            />
            {!playing && (
              <button className="handheld__play" onClick={toggle} aria-label={`Play ${c.name}'s video`}>
                <Play size={24} fill="currentColor" />
                {post.duration ? <span>{formatTime(post.duration - (t > 0 && t < (post.duration ?? 0) - 0.2 ? t : 0))}</span> : null}
              </button>
            )}
            {playing && <span className="handheld__sound"><Volume2 size={14} /> Sound on</span>}
          </>
        ) : (
          <img src={post.src} alt={post.caption} loading="lazy" />
        )}
      </div>

      <p className="handheld__caption">{post.caption}</p>
      {affinity && (
        <p className="handheld__why">
          <span className="handheld__why-score">{affinity.score}</span>
          {affinity.reason}
        </p>
      )}
    </motion.article>
  )
}
