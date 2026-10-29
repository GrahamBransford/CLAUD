import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Pause, Play, RotateCcw, SkipForward, Tv } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dial } from '../components/Dial'
import { SwipeCard, type SwipeDir } from '../components/SwipeCard'
import { Transcript } from '../components/Transcript'
import { creatorById, episodes } from '../data'
import { useKeys } from '../hooks/useKeys'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { formatTime } from '../lib/media'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Episode, SaveMethod } from '../types'
import { AUTO_SAVE_RATIO } from './Singers'

export const hostLine = (ep: Episode) => {
  const c = creatorById[ep.creatorId]
  const hosts = (c.hosts ?? []).join(' & ')
  return ep.guests.length ? `${hosts} with ${ep.guests.join(' & ')}` : hosts
}

export function useSaveEpisode() {
  const save = useStore((s) => s.save)
  const unsave = useStore((s) => s.unsave)
  const pushToast = useUI((s) => s.pushToast)
  const openSheet = useUI((s) => s.openSheet)
  return useCallback(
    (ep: Episode, via: SaveMethod, toggle = false) => {
      if (toggle && useStore.getState().isSaved(ep.id)) {
        unsave(ep.id)
        pushToast({ tone: 'info', title: 'Removed from your collection', detail: ep.title })
        return
      }
      if (save(ep.id, 'episode', via))
        pushToast({
          tone: 'save',
          image: ep.art,
          title: 'Episode saved',
          detail: `${ep.title} · ${creatorById[ep.creatorId].name}`,
          action: { label: 'View', run: () => openSheet({ kind: 'library' }) },
        })
    },
    [save, unsave, pushToast, openSheet],
  )
}

export function Speakers({ active }: { active: boolean }) {
  const index = useStore((s) => s.speakersIndex)
  const setIndex = useStore((s) => s.setSpeakersIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const unlocked = useUI((s) => s.audioUnlocked)
  const openFull = useUI((s) => s.openFullEpisode)
  const saveEpisode = useSaveEpisode()
  const [dir, setDir] = useState<SwipeDir>(-1)
  const [handoff, setHandoff] = useState<Episode | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const ep = episodes[index] as Episode | undefined
  const show = ep ? creatorById[ep.creatorId] : undefined
  const isSaved = ep ? saved.some((s) => s.id === ep.id) : false

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      if (!ep) return
      const ratio = listened / length
      recordListen(ep.creatorId, ratio, listened)
      // Listening through the highlight means "I want more": keep going.
      if (ratio >= AUTO_SAVE_RATIO) setHandoff(ep)
    },
    [ep, recordListen],
  )

  const pb = useWindowedPlayback({
    ref: videoRef,
    itemKey: ep?.id ?? 'end',
    start: 0,
    end: ep?.highlight.duration ?? 1,
    autoplay: unlocked,
    active: active && !handoff,
    onWindowEnd,
  })

  // Seamless progression into the complete episode.
  useEffect(() => {
    if (!handoff) return
    const t = window.setTimeout(() => {
      openFull({ episodeId: handoff.id, startAt: handoff.highlight.sourceEnd, reason: 'auto' })
      setDir(1)
      setIndex(index + 1)
      setHandoff(null)
    }, 2600)
    return () => window.clearTimeout(t)
  }, [handoff, openFull, setIndex, index])

  const next = useCallback(
    (d: SwipeDir) => {
      setDir(d)
      setIndex(index + 1)
    },
    [index, setIndex],
  )

  const skip = useCallback(() => {
    if (!ep) return
    const heard = pb.listened()
    if (heard > 3 && !pb.ended) recordListen(ep.creatorId, heard / pb.length, heard)
    next(-1)
  }, [ep, pb, recordListen, next])

  const watchFull = useCallback(() => {
    if (!ep) return
    pb.pause()
    // pick up the full episode at exactly the moment the highlight reached
    openFull({ episodeId: ep.id, startAt: ep.highlight.sourceStart + pb.time, reason: 'manual' })
  }, [ep, pb, openFull])

  useKeys(active && !!ep, {
    ArrowLeft: skip,
    ArrowRight: () => {
      if (ep) saveEpisode(ep, 'button')
      next(1)
    },
    ' ': pb.toggle,
    r: pb.restart,
    f: watchFull,
  })

  if (!ep || !show)
    return (
      <section className="end-card end-card--speakers">
        <div className="end-card__disc" aria-hidden><span /></div>
        <p className="eyebrow">That&rsquo;s every conversation for today</p>
        <h1>New ideas arrive tomorrow.</h1>
        <p>Saved episodes are waiting in your collection, ready to play in full.</p>
        <div className="end-card__actions">
          <button className="btn btn--accent" onClick={() => useUI.getState().openSheet({ kind: 'library' })}>Open your collection</button>
          <button className="btn" onClick={() => { setDir(1); setIndex(0) }}>Start again</button>
        </div>
      </section>
    )

  const h = ep.highlight
  return (
    <section className="speakers" aria-label="Speakers — podcast discovery">
      <header className="speakers__masthead">
        <p className="eyebrow">Today&rsquo;s conversations · {index + 1} of {episodes.length}</p>
        <p className="speakers__dek">Five minutes of the best part. Stay for the rest if it earns it.</p>
      </header>

      <div className="speakers__grid">
        <div className="speakers__screen">
          <AnimatePresence custom={dir} initial={false} mode="popLayout">
            <SwipeCard key={ep.id} exitDir={dir} className="screen-card" keepLabel="Save" passLabel="Next"
              onSwipe={(d) => {
                if (d === 1) saveEpisode(ep, 'swipe')
                else return skip()
                next(1)
              }}>
              <video
                ref={(el) => {
                  if (el) videoRef.current = el
                }}
                className="screen-card__video"
                src={h.video}
                poster={h.poster}
                playsInline
                preload="auto"
                onClick={pb.toggle}
              />
              <div className="screen-card__chrome">
                <span className="tag tag--glass">Highlight · {formatTime(h.duration)}</span>
              </div>
              {!pb.playing && !pb.ended && !handoff && (
                <button className="sleeve__play" onClick={pb.toggle} aria-label="Play highlight">
                  <Play size={30} fill="currentColor" />
                </button>
              )}
              <AnimatePresence>
                {handoff && (
                  <motion.div className="handoff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="eyebrow">You stayed for the whole highlight</p>
                    <p className="handoff__title">Continuing the full episode…</p>
                    <div className="handoff__bar"><span /></div>
                    <button className="btn btn--light" onClick={() => setHandoff(null)}>Stay in discovery</button>
                  </motion.div>
                )}
                {pb.ended && !handoff && (
                  <motion.div className="sleeve__ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="eyebrow">Highlight complete</p>
                    <div className="sleeve__ended-actions">
                      <button className="btn btn--light" onClick={pb.restart}><RotateCcw size={16} /> Replay</button>
                      <button className="btn btn--accent" onClick={watchFull}>Watch full episode</button>
                      <button className="btn btn--light" onClick={() => next(-1)}>Next conversation</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </SwipeCard>
          </AnimatePresence>

          <div className="speakers__transport">
            <Dial value={pb.time} max={pb.length} onSeek={pb.seek} label={`Highlight from ${ep.title}`} />
            <div className="controls controls--speakers">
              <button className="ctl ctl--ghost" onClick={pb.restart} aria-label="Replay highlight"><RotateCcw size={19} /></button>
              <button className="ctl ctl--pass" onClick={skip} aria-label="Next conversation"><SkipForward size={22} /></button>
              <button className="ctl ctl--play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
                {pb.playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
              </button>
              <button className={`ctl ctl--keep ${isSaved ? 'is-on' : ''}`} onClick={() => saveEpisode(ep, 'button', true)}
                aria-label={isSaved ? 'Remove from collection' : 'Save episode'} aria-pressed={isSaved}>
                <Bookmark size={22} fill={isSaved ? 'currentColor' : 'none'} />
              </button>
              <button className="ctl ctl--ghost" onClick={watchFull} aria-label="Watch full episode"><Tv size={19} /></button>
            </div>
          </div>
        </div>

        <article className="speakers__story">
          <button className="show-line" onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: show.id })}>
            <img src={show.avatar} alt="" />
            <span>
              <strong>{show.name}</strong>
              <em>Episode {ep.number} · {show.genre}</em>
            </span>
          </button>
          <h1 className="episode-title">{ep.title}</h1>
          <p className="episode-hosts">{hostLine(ep)}</p>
          <p className="episode-topic">{ep.topic}</p>

          <Transcript cues={ep.highlightCues} time={pb.time} speakers={ep.speakers} />

          <div className="provenance">
            <div className="provenance__bar" aria-hidden>
              <span style={{ left: `${(h.sourceStart / ep.full.duration) * 100}%`, width: `${((h.sourceEnd - h.sourceStart) / ep.full.duration) * 100}%` }} />
            </div>
            <p>
              <strong>“{ep.highlightTitle}”</strong> — hand-picked from {formatTime(h.sourceStart)}–{formatTime(h.sourceEnd)} of the
              {' '}{formatTime(ep.full.duration)} episode. Finish it and the full episode keeps playing.
            </p>
          </div>
          <button className="btn btn--outline btn--full" onClick={watchFull}>
            <Tv size={17} /> Watch full episode <span className="btn__aside">picks up at {formatTime(h.sourceStart + pb.time)}</span>
          </button>
        </article>
      </div>
    </section>
  )
}
