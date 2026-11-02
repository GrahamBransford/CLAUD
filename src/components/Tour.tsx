import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { RecordC } from './Logo'
import * as I from './Icons'
import { tick } from '../lib/haptics'

/**
 * The first-run tour, Instagram-style: a welcome, then a spotlight that moves
 * across the real, live app (videos keep playing behind it), a short card
 * explaining each thing, and a few moments where you tap the real control
 * yourself to carry on. It ends on what CIRCA stands for. Shown once per
 * device; Settings can replay it.
 */

const KEY = 'circa-tour'
export const tourSeen = () => {
  try {
    return localStorage.getItem(KEY) === 'done'
  } catch {
    return false // storage blocked (a private window): show it; it's always one tap to skip
  }
}
const markSeen = () => {
  try {
    localStorage.setItem(KEY, 'done')
  } catch {
    /* the tour may show again next time */
  }
}

type Route = 'radio' | 'artists' | 'inner-circle' | 'vinyl'

interface Step {
  /** The page this step happens on. */
  route?: Route
  /** What the spotlight sits on: the first of these that's on screen. */
  target?: string
  /** A circle rather than a rounded rectangle. */
  round?: boolean
  /** Tap the real control to carry on (instead of Next). */
  tap?: boolean
  title: string
  body: ReactNode
  /** Extra, step-specific illustration inside the card. */
  extra?: 'gestures'
  /** On the reel itself: an animated ghost thumb demonstrating the swipes. */
  ghost?: boolean
}

const STEPS: Step[] = [
  {
    route: 'radio',
    target: '.view[data-active] .reel',
    ghost: true,
    title: 'The Radio',
    body: 'Music and conversations in one running stream, like a station that knows what you love.',
    extra: 'gestures',
  },
  {
    route: 'radio',
    target: '.view[data-active] .reel__who',
    title: 'The people behind it',
    body: 'Every song and show is credited to a person. Tap a name to see how close you are, their communities, and what they’ve made.',
  },
  {
    route: 'radio',
    target: '.tab[aria-label="Music"]',
    round: true,
    tap: true,
    title: 'Just the music',
    body: 'Music is the songs on their own, full screen. Tap it.',
  },
  {
    route: 'artists',
    target: '.view[data-active] .reel',
    title: 'Pinch to keep it with you',
    body: 'Pinch any video and it floats in a corner, still playing, while you explore. Pop it out and it keeps going after you leave the app.',
  },
  {
    route: 'artists',
    target: '.tab[aria-label="Inner Circle"]',
    round: true,
    tap: true,
    title: 'Inner Circle',
    body: 'Behind the scenes from the creators you follow. Tap to step inside.',
  },
  {
    route: 'inner-circle',
    target: '.view[data-active] .moment',
    title: 'Closer than the record',
    body: 'Rehearsals, soundchecks, the moments before the show. Double-tap to send love. Swipe up for the next.',
  },
  {
    route: 'inner-circle',
    target: '.tab--vinyl',
    round: true,
    tap: true,
    title: 'Your vinyl',
    body: 'Home is your record: your taste, made visible. Tap it.',
  },
  {
    route: 'vinyl',
    target: '.view[data-active] .hifi__record',
    round: true,
    title: 'Closer to the centre, closer to you',
    body: 'Everyone you listen to sits on your record. The more you listen, the nearer the middle they move. A star marks a favourite. Spin it with your thumb.',
  },
  {
    route: 'vinyl',
    target: '.view[data-active] .knob[aria-label^="Friends"]',
    round: true,
    title: 'Friends',
    body: 'See what friends are discovering, and how much your tastes overlap. No messaging, no feeds to keep up with: just people who love what you love.',
  },
  {
    route: 'vinyl',
    target: '.view[data-active] .readout--communities, .view[data-active] .readouts',
    title: 'Real community',
    body: 'Groups around the creators you love, online and in person near you: listening nights, record swaps, shows you go to together.',
  },
  {
    route: 'vinyl',
    target: '.view[data-active] .hifi__settings',
    round: true,
    title: 'Made for the road',
    body: 'Behind the C: your account, and Drive mode. Hands-free, big controls, audio only, so CIRCA goes with you in the car.',
  },
]

type Phase = 'welcome' | 'steps' | 'finale'

export function Tour({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('welcome')
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const rect = useTargetRect(phase === 'steps' ? step.target : undefined)

  // each step happens on its own page
  useEffect(() => {
    if (phase !== 'steps' || !step.route) return
    if (window.location.hash !== `#${step.route}`) window.location.hash = step.route
  }, [phase, step])

  const finish = useCallback(() => {
    markSeen()
    if (window.location.hash !== '#radio') window.location.hash = 'radio'
    onDone()
  }, [onDone])
  const next = useCallback(() => {
    tick()
    if (phase === 'welcome') setPhase('steps')
    else if (phase === 'steps') {
      if (i < STEPS.length - 1) setI(i + 1)
      else setPhase('finale')
    } else finish()
  }, [phase, i, finish])

  // a step whose thing isn't on this screen (a different layout) quietly moves on
  useEffect(() => {
    if (phase !== 'steps' || rect) return
    const t = window.setTimeout(next, 2400)
    return () => window.clearTimeout(t)
  }, [phase, rect, next])

  // a "tap it" step: the real control does its job, and the tour follows
  useEffect(() => {
    if (phase !== 'steps' || !step.tap || !step.target) return
    const onClick = (e: MouseEvent) => {
      const hit = step.target!.split(/,(?![^[]*\])/).some((sel) => document.querySelector(sel.trim())?.contains(e.target as Node))
      if (hit) window.setTimeout(next, 380)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [phase, step, next])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && !(phase === 'steps' && step.tap)) next()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [next, finish, phase, step])

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Welcome to CIRCA">
      <AnimatePresence mode="wait">
        {phase === 'welcome' && <Welcome key="welcome" onStart={next} onSkip={finish} />}
        {phase === 'finale' && <Finale key="finale" onDone={finish} />}
      </AnimatePresence>
      {phase === 'steps' && (
        <>
          <Spotlight rect={rect} round={!!step.round} open={!!step.tap} />
          {step.ghost && rect && <Ghost rect={rect} />}
          <AnimatePresence mode="wait">
            {rect && <Card key={i} step={step} index={i} rect={rect} onNext={next} />}
          </AnimatePresence>
        </>
      )}
      {phase !== 'finale' && <SkipCorner rect={phase === 'steps' ? rect : null} onSkip={finish} />}
    </div>
  )
}

/** Follows the target as it moves or the page changes, so the spotlight always sits true. */
function useTargetRect(selector?: string) {
  const [state, setState] = useState<{ sel: string; rect: DOMRect } | null>(null)
  const last = useRef('')
  useLayoutEffect(() => {
    if (!selector) return
    let raf = 0
    last.current = ''
    const pick = () => {
      for (const sel of selector.split(/,(?![^[]*\])/)) {
        const el = document.querySelector<HTMLElement>(sel.trim())
        if (el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden') return el
      }
      return null
    }
    const read = () => {
      const el = pick()
      const r = el?.getBoundingClientRect()
      // only once the page has finished sliding in
      const view = el?.closest<HTMLElement>('.view')
      const settled = !view || Math.abs(view.getBoundingClientRect().left - (view.parentElement?.getBoundingClientRect().left ?? 0)) < 1
      if (r && r.width > 0 && settled) {
        const k = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`
        if (k !== last.current) {
          last.current = k
          setState({ sel: selector, rect: r })
        }
      }
      raf = requestAnimationFrame(read)
    }
    raf = requestAnimationFrame(read)
    return () => cancelAnimationFrame(raf)
  }, [selector])
  return selector && state?.sel === selector ? state.rect : null
}

/**
 * The dimmed room with a lit cut-out. Four transparent panels around the
 * cut-out catch stray taps; on a "tap it" step the cut-out itself is open,
 * so the real control works.
 */
function Spotlight({ rect, round, open }: { rect: DOMRect | null; round: boolean; open: boolean }) {
  const pad = round ? 8 : 6
  const r = rect
    ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 }
  const big = r.w > window.innerWidth * 0.7
  const radius = round ? Math.max(r.w, r.h) / 2 : big ? 22 : 16
  return (
    <>
      <motion.div
        className={`tour__hole ${open ? 'is-open' : ''}`}
        initial={false}
        animate={{ left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: radius }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      />
      {/* catch taps everywhere but the lit control */}
      <div className="tour__block" style={{ left: 0, top: 0, right: 0, height: Math.max(0, r.y) }} />
      <div className="tour__block" style={{ left: 0, top: r.y + r.h, right: 0, bottom: 0 }} />
      <div className="tour__block" style={{ left: 0, top: r.y, width: Math.max(0, r.x), height: r.h }} />
      <div className="tour__block" style={{ left: r.x + r.w, top: r.y, right: 0, height: r.h }} />
      {!open && <div className="tour__block" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />}
    </>
  )
}

/**
 * Always in the corner, quiet but always there: one tap ends the intro for
 * anyone who'd rather find their own way. It moves to the other corner if
 * the thing being shown sits under it.
 */
function SkipCorner({ rect, onSkip }: { rect: DOMRect | null; onSkip: () => void }) {
  const under = !!rect && rect.top < 72 && rect.right > window.innerWidth - 140 && rect.width < window.innerWidth * 0.6
  return (
    <motion.button
      className={`tour__corner${under ? ' is-left' : ''}`}
      onClick={onSkip}
      aria-label="Skip the intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.4, duration: 0.4 } }}
    >
      Skip intro
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </motion.button>
  )
}

/** A ghost thumb on the Radio, showing the three moves: right to save, left to skip, up for next. */
function Ghost({ rect }: { rect: DOMRect }) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height * 0.42
  return (
    <div className="tour__ghost-wrap" style={{ left: cx, top: cy }} aria-hidden>
      <motion.span
        className="tour__ghost"
        animate={{ x: [0, 0, 70, 70, 0, 0, -70, -70, 0, 0, 0, 0], y: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -80, -80], opacity: [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0] }}
        transition={{ duration: 6, times: [0, 0.06, 0.22, 0.3, 0.34, 0.4, 0.56, 0.64, 0.7, 0.76, 0.92, 1], repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

function Card({ step, index, rect, onNext }: { step: Step; index: number; rect: DOMRect; onNext: () => void }) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(340, vw - 32)
  // beside the lit thing when there's room (the desktop rail, a big record), else above or below it,
  // and over it, near the bottom, when it fills the screen
  const side = vw - rect.right > w + 48 && (rect.height > 160 || rect.right < 160) && rect.width < vw * 0.7
  const filling = !side && rect.height > vh * 0.55
  const below = !side && !filling && rect.top + rect.height / 2 < vh * 0.5
  const left = side ? rect.right + 22 : Math.min(vw - w - 16, Math.max(16, rect.left + rect.width / 2 - w / 2))
  const sideTop = Math.min(vh - 300, Math.max(64, rect.top + rect.height / 2 - 120))
  const style = side
    ? { left, top: sideTop, width: w }
    : filling
      ? { left, bottom: Math.max(96, vh - rect.bottom + 28), width: w }
      : below
        ? { left, top: rect.bottom + 18, width: w }
        : { left, bottom: vh - rect.top + 18, width: w }
  const arrowX = Math.min(w - 26, Math.max(26, rect.left + rect.width / 2 - left))
  const arrowY = Math.min(260, Math.max(24, rect.top + rect.height / 2 - sideTop))
  return (
    <motion.div
      className="tour__card"
      style={style}
      initial={{ opacity: 0, x: side ? -8 : 0, y: side ? 0 : below ? -8 : 8, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: 0.28, ease: [0.2, 0.75, 0.15, 1] } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
    >
      {side ? (
        <span className="tour__arrow is-left" style={{ top: arrowY }} aria-hidden />
      ) : (
        !filling && <span className={`tour__arrow ${below ? 'is-up' : 'is-down'}`} style={{ left: arrowX }} aria-hidden />
      )}
      <p className="tour__eyebrow">
        {index + 1} of {STEPS.length}
      </p>
      <h2 className="tour__title">{step.title}</h2>
      <p className="tour__body">{step.body}</p>
      {step.extra === 'gestures' && (
        <ul className="tour__gestures">
          <li>
            <span className="tour__gesture tour__gesture--save">
              <I.Love size={14} on />
            </span>
            <span>
              Swipe right to <strong>save</strong>
            </span>
          </li>
          <li>
            <span className="tour__gesture">
              <I.Close size={13} />
            </span>
            <span>
              Swipe left to <strong>skip</strong>
            </span>
          </li>
          <li>
            <span className="tour__gesture tour__gesture--up">
              <I.Down size={13} />
            </span>
            <span>
              Swipe up for <strong>what’s next</strong>
            </span>
          </li>
        </ul>
      )}
      <div className="tour__foot">
        {step.tap ? (
          <span className="tour__hint">Tap it to continue</span>
        ) : (
          <button className="tour__next" onClick={onNext}>
            {index === STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        )}
      </div>
    </motion.div>
  )
}

function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <motion.div className="tour__screen" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.45 } }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
      <div className="tour__panel">
        <motion.span className="tour__mark" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { delay: 0.1, type: 'spring', stiffness: 220, damping: 18 } }}>
          <RecordC spinning />
        </motion.span>
        <p className="tour__kicker">Welcome to CIRCA</p>
        <h1 className="tour__headline tour__headline--welcome">Your new radio.</h1>
        <ul className="tour__pillars">
          <Pillar icon={<I.People size={18} />} title="Real community" text="Friends, fans and creators: online and in your city." />
          <Pillar icon={<I.Spark size={18} on />} title="Creators first" text="Every song and show credited to a person, and found through them." />
          <Pillar icon={<I.Car size={18} />} title="Effortless, even driving" text="Tailored to what you love, with a hands-free mode for the car." />
        </ul>
        <button className="tour__primary" onClick={onStart}>
          Show me around
        </button>
        <button className="tour__quiet" onClick={onSkip}>
          I’ll explore on my own
        </button>
      </div>
    </motion.div>
  )
}

function Finale({ onDone }: { onDone: () => void }) {
  return (
    <motion.div className="tour__screen" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.4 } }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
      <div className="tour__panel">
        <motion.span className="tour__mark" initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1, transition: { duration: 0.6, ease: [0.2, 0.75, 0.15, 1] } }}>
          <RecordC spinning />
        </motion.span>
        <p className="tour__kicker">Before you press play</p>
        <h1 className="tour__headline">One more thing.</h1>
        <ul className="tour__pillars tour__pillars--promise">
          <Pillar
            icon={
              <svg className="tour__noai" viewBox="0 0 36 36" width="36" height="36" aria-hidden>
                <text x="18" y="22.5" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="currentColor" fontFamily="inherit">AI</text>
                <circle cx="18" cy="18" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M9.9 26.1 26.1 9.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            } title="No AI. Ever." text="Every song, show and recommendation comes from people and from what you actually play. Nothing is generated." />
          <Pillar icon={<span className="tour__free">$0</span>} title="Free, with one ad every 30 minutes" text="That one ad is how the creators you love get paid properly, not fractions of a cent per play." />
          <Pillar icon={<I.People size={18} />} title="Real people, real places" text="Communities, shows and friends who share your taste. Your vinyl is yours to show." />
        </ul>
        <button className="tour__primary" onClick={onDone}>
          Start listening
        </button>
      </div>
    </motion.div>
  )
}

function Pillar({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="tour__pillar">
      <span className="tour__pillar-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <em>{text}</em>
      </span>
    </li>
  )
}
