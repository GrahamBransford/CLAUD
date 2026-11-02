import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { creatorById } from '../data'
import { claimAudioFocus, releaseAudioFocus } from '../lib/media'
import { useStore } from '../store/useStore'
import { useUI, type MiniItem } from '../store/useUI'
import * as I from './Icons'

/* eslint-disable @typescript-eslint/no-explicit-any */
const pipSupported = () =>
  typeof document !== 'undefined' &&
  (!!(document as any).pictureInPictureEnabled || typeof (HTMLVideoElement.prototype as any).webkitSetPresentationMode === 'function')

/** Hand the video to the system's own picture-in-picture, so it keeps playing outside CIRCA. */
async function popOut(v: HTMLVideoElement) {
  try {
    if ((v as any).requestPictureInPicture) await (v as any).requestPictureInPicture()
    else (v as any).webkitSetPresentationMode?.('picture-in-picture')
  } catch {
    /* the browser said no (it wants a tap first, or the feature is off) */
  }
}

/**
 * A video floated out of its feed by a pinch. It keeps playing while you go
 * anywhere in the app; drag it to any corner; tap to pause; expand to go back
 * to it in its feed, picking up where it got to; or pop it out to the
 * system's picture-in-picture to keep watching outside the app.
 */
export function MiniPlayer() {
  const mini = useUI((s) => s.mini)
  return <AnimatePresence>{mini && <Mini key={mini.id} m={mini} />}</AnimatePresence>
}

function Mini({ m }: { m: MiniItem }) {
  const bounds = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const unlocked = useUI((s) => s.audioUnlocked)
  const [paused, setPaused] = useState(false)
  const c = creatorById[m.creatorId]

  useEffect(() => {
    const v = video.current
    if (!v) return
    const start = () => {
      v.currentTime = m.time
      claimAudioFocus(v)
      v.play().catch(() => {
        v.muted = true
        void v.play().catch(() => setPaused(true))
      })
    }
    if (v.readyState >= 1) start()
    else v.addEventListener('loadedmetadata', start, { once: true })
    // leaving the app (home screen, another tab): try the system picture-in-picture
    const onHide = () => document.visibilityState === 'hidden' && !v.paused && void popOut(v)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      v.removeEventListener('loadedmetadata', start)
      v.pause()
      releaseAudioFocus(v)
    }
  }, [m.time])

  useEffect(() => {
    if (video.current) video.current.muted = !unlocked
  }, [unlocked])

  const toggle = () => {
    const v = video.current
    if (!v) return
    if (v.paused) {
      claimAudioFocus(v)
      void v.play()
    } else v.pause()
  }

  // back to its place in the feed, carrying on from here
  const expand = () => {
    const time = video.current?.currentTime ?? m.time
    const st = useStore.getState()
    if (m.route === 'artists') st.setArtistsIndex(m.index)
    else if (m.route === 'radio') st.setRadioIndex(m.index)
    else st.setCircleIndex(m.index)
    useUI.getState().setResume({ id: m.id, time })
    useUI.getState().openPerson(null)
    useUI.getState().openMini(null)
    window.location.hash = m.route
  }
  const close = () => {
    useUI.getState().setResume({ id: m.id, time: video.current?.currentTime ?? m.time })
    useUI.getState().openMini(null)
  }

  return (
    <div className="mini-bounds" ref={bounds}>
      <motion.div
        className={`mini ${m.vertical ? 'mini--tall' : 'mini--wide'}`}
        drag
        dragConstraints={bounds}
        dragElastic={0.08}
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 32 } }}
        exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.18 } }}
        role="region"
        aria-label={`Now playing: ${m.title}`}
      >
        <video
          ref={video}
          className="mini__video"
          src={m.src}
          poster={m.poster}
          playsInline
          autoPlay
          muted={!unlocked}
          loop={m.kind === 'moment'}
          preload="auto"
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onClick={toggle}
          {...{ autopictureinpicture: '' }}
        />
        {paused && (
          <span className="mini__paused" aria-hidden>
            <I.Play size={22} />
          </span>
        )}
        <div className="mini__bar">
          <span className="mini__who">{c?.name}</span>
          <button className="mini__btn" onClick={expand} aria-label="Back to full screen">
            <I.Expand size={15} />
          </button>
          {pipSupported() && (
            <button className="mini__btn" onClick={() => video.current && void popOut(video.current)} aria-label="Keep playing outside CIRCA">
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" />
              </svg>
            </button>
          )}
          <button className="mini__btn" onClick={close} aria-label="Close">
            <I.Close size={15} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}
