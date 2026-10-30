import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, Heart, Info, Mic2, Music2, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MediaSurface } from '../components/MediaSurface'
import { TierBadge } from '../components/Tier'
import { creatorById, creators, innerCircle } from '../data'
import { useKeys } from '../hooks/useKeys'
import { formatTop, rankInnerCircle, type Relationship } from '../lib/affinity'
import { claimAudioFocus, relativeHours } from '../lib/media'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { InnerCirclePost } from '../types'
import { usePlayerRef } from './Artists'

export function useFollow() {
  const toggle = useStore((s) => s.toggleFollow)
  const pushToast = useUI((s) => s.pushToast)
  return (creatorId: string) => {
    const now = toggle(creatorId)
    const c = creatorById[creatorId]
    pushToast({
      tone: 'follow',
      image: c?.avatar,
      title: now ? `Following ${c?.name}` : `Unfollowed ${c?.name}`,
      detail: now ? 'Their Inner Circle moments now reach you.' : 'Their posts have left your Inner Circle.',
    })
  }
}

const SWIPE = 90

export function InnerCircle({ active }: { active: boolean }) {
  const follows = useStore((s) => s.follows)
  const signals = useStore((s) => s.signals)
  const saved = useStore((s) => s.saved)
  const index = useStore((s) => s.circleIndex)
  const setIndex = useStore((s) => s.setCircleIndex)
  const feed = useMemo(() => rankInnerCircle(follows, signals, saved), [follows, signals, saved])
  const [dir, setDir] = useState(1)
  const total = feed.length + 1 // the last slide is "you're caught up"
  const i = Math.min(index, total - 1)

  const go = useCallback(
    (d: number) => {
      const n = Math.max(0, Math.min(total - 1, i + d))
      if (n === i) return
      setDir(d)
      setIndex(n)
    },
    [i, total, setIndex],
  )

  useKeys(active, { ArrowRight: () => go(1), ArrowLeft: () => go(-1) })

  // Swipe right = next, swipe left = previous (CIRCA's sideways feed).
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE || info.velocity.x > 600) go(1)
    else if (info.offset.x < -SWIPE || info.velocity.x < -600) go(-1)
  }

  if (feed.length === 0)
    return (
      <section className="ic ic--empty">
        <div className="ic__empty">
          <p className="eyebrow">Inner Circle</p>
          <h1>Nobody in your circle yet.</h1>
          <p>Follow the artists and podcasters you discover. Their unpolished, behind-the-scenes moments land here, closest relationships first.</p>
          <Suggestions />
        </div>
      </section>
    )

  const item = feed[i]
  return (
    <section className="ic" aria-label="Inner Circle — behind the work" aria-roledescription="carousel">
      <div className="ic__top">
        <div className="ic__ticks" aria-hidden>
          {Array.from({ length: total }, (_, k) => <span key={k} data-on={k <= i ? '' : undefined} />)}
        </div>
        <button className="ic__why" onClick={() => useUI.getState().openSheet({ kind: 'tuning' })}>
          <Info size={14} /> Only people you follow, closest first
        </button>
      </div>

      <div className="ic__stage">
        <button className="ic__nav ic__nav--prev" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous moment">
          <ChevronLeft size={28} />
        </button>
        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            key={item ? item.post.id : 'end'}
            className="ic__slide"
            custom={dir}
            drag="x"
            dragSnapToOrigin
            dragElastic={0.5}
            onDragEnd={onDragEnd}
            initial={{ x: dir > 0 ? '-60%' : '60%', opacity: 0, rotate: dir > 0 ? -4 : 4 }}
            animate={{ x: 0, opacity: 1, rotate: 0, transition: { type: 'spring', stiffness: 260, damping: 30 } }}
            exit={{ x: dir > 0 ? '60%' : '-60%', opacity: 0, rotate: dir > 0 ? 4 : -4, transition: { duration: 0.3 } }}
          >
            {item ? (
              <Moment post={item.post} rel={item.rel} active={active} onEnded={() => go(1)} />
            ) : (
              <CaughtUp onRestart={() => { setDir(-1); setIndex(0) }} />
            )}
          </motion.div>
        </AnimatePresence>
        <button className="ic__nav ic__nav--next" onClick={() => go(1)} disabled={i === total - 1} aria-label="Next moment">
          <ChevronRight size={28} />
        </button>
      </div>
      <p className="ic__hint">Swipe right for the next moment, left to go back.</p>
    </section>
  )
}

function Moment({ post, rel, active, onEnded }: { post: InnerCirclePost; rel: Relationship; active: boolean; onEnded: () => void }) {
  const c = creatorById[post.creatorId]
  const unlocked = useUI((s) => s.audioUnlocked)
  const follows = useStore((s) => s.follows)
  const reacted = useStore((s) => s.reacted.includes(post.id))
  const toggleReaction = useStore((s) => s.toggleReaction)
  const recordView = useStore((s) => s.recordView)
  const follow = useFollow()
  const player = usePlayerRef()
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isVideo = post.media.kind === 'video' || post.media.kind === 'youtube'

  // Autoplay the moment in view (with sound once the listener has tapped anything).
  useEffect(() => {
    const p = player.ref.current
    if (!p) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    let maxT = 0
    const onTime = () => {
      maxT = Math.max(maxT, p.currentTime)
      if (p.duration > 0 && maxT / p.duration > 0.6) recordView(post.id, post.creatorId)
    }
    const onEnd = () => {
      recordView(post.id, post.creatorId)
      window.setTimeout(onEnded, 1200)
    }
    p.addEventListener('play', onPlay)
    p.addEventListener('pause', onPause)
    p.addEventListener('timeupdate', onTime)
    p.addEventListener('ended', onEnd)
    if (active && unlocked) {
      claimAudioFocus(p)
      p.play().catch(() => setPlaying(false))
    }
    return () => {
      p.removeEventListener('play', onPlay)
      p.removeEventListener('pause', onPause)
      p.removeEventListener('timeupdate', onTime)
      p.removeEventListener('ended', onEnd)
      p.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.version, active, unlocked])

  const toggle = () => {
    const p = player.ref.current
    if (!p) return
    if (p.paused) {
      claimAudioFocus(p)
      void p.play().catch(() => undefined)
    } else p.pause()
  }

  if (!c) return null
  return (
    <article className={`moment moment--${post.media.kind}`}>
      <div className="moment__frame">
        {isVideo ? (
          <MediaSurface source={post.media} className="moment__media" onPlayer={player.onPlayer} onError={setError} onClick={toggle} />
        ) : (
          <MediaSurface source={post.media} className="moment__media" onPlayer={() => undefined} />
        )}
        {isVideo && post.media.kind !== 'youtube' && !playing && !error && (
          <button className="moment__play" onClick={toggle} aria-label={`Play ${c.name}'s video`}>
            <Play size={26} fill="currentColor" />
          </button>
        )}
        {error && <div className="sleeve__error"><p>{error}</p></div>}
      </div>

      <div className="moment__info">
        <button className="moment__who" onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: c.id })}>
          <img src={c.avatar} alt="" />
          <span>
            <strong>{c.name}</strong>
            <em>
              <span className={`kind kind--${c.kind}`}>{c.kind === 'artist' ? <Music2 size={11} /> : <Mic2 size={11} />} {c.kind === 'artist' ? 'Artist' : 'Podcast'}</span>
              {' '}· {post.context} · {relativeHours(post.postedHoursAgo)}
            </em>
          </span>
        </button>
        <p className="moment__caption">{post.caption}</p>
        <div className="moment__rel">
          <TierBadge tier={rel.tier.id} size="sm" />
          <span>
            {rel.tier.id === 'top1' ? (
              <><strong>Top 1%</strong> of listeners <small>(estimate)</small></>
            ) : (
              <><strong>{rel.tier.label}</strong> · {formatTop(rel.top)} of listeners <small>(estimate)</small></>
            )}
          </span>
        </div>
        <div className="moment__actions">
          <button className={`react-btn ${reacted ? 'is-on' : ''}`} onClick={() => toggleReaction(post.id, post.creatorId)} aria-pressed={reacted}>
            <Heart size={17} fill={reacted ? 'currentColor' : 'none'} /> {reacted ? 'Sent' : 'Send love'}
          </button>
          <button className={`follow-btn follow-btn--dark ${follows.includes(c.id) ? 'is-on' : ''}`} onClick={() => follow(c.id)}>
            {follows.includes(c.id) ? 'Following' : 'Follow'}
          </button>
          <button className="link-btn link-btn--on-dark" onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: c.id })}>Profile</button>
        </div>
      </div>
    </article>
  )
}

function CaughtUp({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="caught">
      <div className="caught__disc" aria-hidden><span /></div>
      <p className="eyebrow">You&rsquo;re all caught up</p>
      <h2>That&rsquo;s everyone in your circle.</h2>
      <p>No endless scroll. Go listen to something, and the people you return to will move closer.</p>
      <button className="btn btn--accent" onClick={onRestart}>Back to the first moment</button>
      <Suggestions />
    </div>
  )
}

function Suggestions() {
  const follows = useStore((s) => s.follows)
  const follow = useFollow()
  const outside = creators.filter((c) => !follows.includes(c.id) && innerCircle.some((p) => p.creatorId === c.id))
  if (!outside.length) return null
  return (
    <div className="suggest">
      <p className="eyebrow">Not in your circle yet</p>
      <ul>
        {outside.map((c) => (
          <li key={c.id}>
            <img src={c.avatar} alt="" />
            <span><strong>{c.name}</strong><em>{c.kind === 'artist' ? 'Artist' : 'Podcast'} · {c.genre}</em></span>
            <button className="follow-btn follow-btn--dark" onClick={() => follow(c.id)}>Follow</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
