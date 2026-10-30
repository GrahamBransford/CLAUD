import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import * as I from '../components/Icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TapFlash, TopBar, useTapFlash } from '../components/Hud'
import { RecordC } from '../components/Logo'
import { MediaSurface } from '../components/MediaSurface'
import { creatorById, creators, innerCircle } from '../data'
import { useKeys } from '../hooks/useKeys'
import { rankInnerCircle } from '../lib/affinity'
import { claimAudioFocus } from '../lib/media'
import { useStore } from '../store/useStore'
import { tapWasUnlock, useUI } from '../store/useUI'
import type { InnerCirclePost } from '../types'
import { usePlayerRef } from './Artists'

export function useFollow() {
  const toggle = useStore((s) => s.toggleFollow)
  const pushToast = useUI((s) => s.pushToast)
  return (creatorId: string) => {
    const now = toggle(creatorId)
    const c = creatorById[creatorId]
    pushToast({ image: c?.avatar, title: now ? `Following ${c?.name}` : `Unfollowed ${c?.name}` })
  }
}

const EASE = [0.22, 0.7, 0.18, 1] as const

export function InnerCircle({ active }: { active: boolean }) {
  const follows = useStore((s) => s.follows)
  const signals = useStore((s) => s.signals)
  const saved = useStore((s) => s.saved)
  const index = useStore((s) => s.circleIndex)
  const setIndex = useStore((s) => s.setCircleIndex)
  const feed = useMemo(() => rankInnerCircle(follows, signals, saved), [follows, signals, saved])
  const [dir, setDir] = useState(1)
  const total = feed.length + 1 // the last page is "you're caught up"
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

  // Swipe right = next, swipe left = previous.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 80 || info.velocity.x > 550) go(1)
    else if (info.offset.x < -80 || info.velocity.x < -550) go(-1)
  }

  const item = feed[i]
  return (
    <section className="screen screen--ic" aria-label="Inner Circle">
      {feed.length > 0 && (
        <div className="segments" aria-hidden>
          {Array.from({ length: feed.length }, (_, k) => <span key={k} data-on={k <= i ? '' : undefined} />)}
        </div>
      )}
      <AnimatePresence custom={dir} initial={false} mode="popLayout">
        <motion.div
          key={item ? item.post.id : 'end'}
          className="page"
          custom={dir}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.85}
          dragTransition={{ bounceStiffness: 520, bounceDamping: 42 }}
          onDragEnd={onDragEnd}
          variants={{
            initial: (d: number) => ({ x: d > 0 ? '-100%' : '100%' }),
            enter: { x: 0, transition: { duration: 0.36, ease: EASE } },
            exit: (d: number) => ({ x: d > 0 ? '100%' : '-100%', transition: { duration: 0.36, ease: EASE } }),
          }}
          initial="initial"
          animate="enter"
          exit="exit"
        >
          {item ? <Moment post={item.post} active={active} onEnded={() => go(1)} /> : <CaughtUp empty={feed.length === 0} onRestart={() => { setDir(-1); setIndex(0) }} />}
        </motion.div>
      </AnimatePresence>
      <TopBar playing={false} />
    </section>
  )
}

function Moment({ post, active, onEnded }: { post: InnerCirclePost; active: boolean; onEnded: () => void }) {
  const c = creatorById[post.creatorId]
  const follows = useStore((s) => s.follows)
  const reacted = useStore((s) => s.reacted.includes(post.id))
  const toggleReaction = useStore((s) => s.toggleReaction)
  const recordView = useStore((s) => s.recordView)
  const unlocked = useUI((s) => s.audioUnlocked)
  const follow = useFollow()
  const player = usePlayerRef()
  const flash = useTapFlash()
  const [playing, setPlaying] = useState(false)
  const isVideo = post.media.kind === 'video' || post.media.kind === 'youtube'

  useEffect(() => {
    const p = player.ref.current
    if (!p || !isVideo) return
    let maxT = 0
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => {
      maxT = Math.max(maxT, p.currentTime)
      if (p.duration > 0 && maxT / p.duration > 0.6) recordView(post.id, post.creatorId)
    }
    const onEnd = () => {
      recordView(post.id, post.creatorId)
      window.setTimeout(onEnded, 600)
    }
    p.addEventListener('play', onPlay)
    p.addEventListener('pause', onPause)
    p.addEventListener('timeupdate', onTime)
    p.addEventListener('ended', onEnd)
    if (active) {
      claimAudioFocus(p)
      p.muted = !useUI.getState().audioUnlocked
      p.play().catch(() => setPlaying(false))
    } else p.pause()
    return () => {
      p.removeEventListener('play', onPlay)
      p.removeEventListener('pause', onPause)
      p.removeEventListener('timeupdate', onTime)
      p.removeEventListener('ended', onEnd)
      p.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.version, active])

  useEffect(() => {
    if (unlocked && player.ref.current) player.ref.current.muted = false
  }, [unlocked, player.ref])

  const tap = () => {
    const p = player.ref.current
    if (!p || tapWasUnlock()) return
    if (p.muted) {
      p.muted = false
      useUI.getState().unlockAudio()
      return
    }
    flash.show(playing ? 'pause' : 'play')
    if (p.paused) {
      claimAudioFocus(p)
      void p.play().catch(() => undefined)
    } else p.pause()
  }

  if (!c) return null
  const following = follows.includes(c.id)
  return (
    <motion.div className={`moment moment--${post.media.kind}`} onTap={(e) => !(e.target as Element).closest('button') && tap()}>
      <MediaSurface source={post.media} className="moment__media" onPlayer={isVideo ? player.onPlayer : () => undefined} />
      <div className="reel__scrim" aria-hidden />
      <TapFlash state={flash.state} />
      <div className="moment__meta">
        <div className="moment__who">
          <button className="moment__avatar" onClick={() => useUI.getState().openSheet({ kind: 'creator', creatorId: c.id })} aria-label={c.name}>
            <img src={c.avatar} alt="" />
          </button>
          <button className="moment__name" onClick={() => useUI.getState().openSheet({ kind: 'creator', creatorId: c.id })}>{c.name}</button>
          {!following && (
            <button className="moment__follow" onClick={() => follow(c.id)} aria-label={`Follow ${c.name}`}><I.Plus size={15} /></button>
          )}
        </div>
        <p className="moment__caption">{post.caption}</p>
      </div>
      <div className="rail rail--ic">
        <button className={`rail__btn rail__btn--save ${reacted ? 'is-on' : ''}`} onClick={() => toggleReaction(post.id, post.creatorId)} aria-label="Send love" aria-pressed={reacted}>
          <I.Love size={26} on={reacted} />
        </button>
      </div>
    </motion.div>
  )
}

function CaughtUp({ empty, onRestart }: { empty: boolean; onRestart: () => void }) {
  const follows = useStore((s) => s.follows)
  const follow = useFollow()
  const outside = creators.filter((c) => !follows.includes(c.id) && innerCircle.some((p) => p.creatorId === c.id))
  return (
    <div className="end end--ic">
      <span className="end__disc"><RecordC /></span>
      <p className="end__title">{empty ? 'Follow someone to start your circle.' : 'You’re all caught up.'}</p>
      {!empty && <button className="pill" onClick={onRestart}>From the top</button>}
      {outside.length > 0 && (
        <div className="faces">
          {outside.map((c) => (
            <button key={c.id} className="face" onClick={() => follow(c.id)} aria-label={`Follow ${c.name}`}>
              <img src={c.avatar} alt="" />
              <span>{c.name}</span>
              <i><I.Plus size={13} /></i>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
