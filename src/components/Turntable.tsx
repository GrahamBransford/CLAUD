import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type React from 'react'
import type { TierId } from '../lib/affinity'
import * as I from './Icons'
import { tick } from '../lib/haptics'

/**
 * A cabinet record player: the deck from above, the front below. The record is someone's vinyl: their
 * photo on the label, their creators set into the grooves by closeness
 * (centre = closest), their live experiences etched in the run-out.
 * Used for your own vinyl and for anyone else's.
 */

export interface Marker {
  id: string
  name: string
  avatar: string
  /** Simulated "top X%" of that creator's listeners: sets the radius. */
  top: number
  tier: TierId
  /** Not followed: set back a little. */
  faint?: boolean
  /** Moved inward since the last visit. */
  closer?: boolean
  /** Seen live. */
  live?: boolean
  favorite?: boolean
  /** On both your vinyl and theirs. */
  shared?: boolean
}

/** Equal-width bands for each tier, log-scaled inside a band. Centre = top 0.1%. */
const BANDS = [0.1, 1, 5, 20, 50, 100]
function bandRadius(top: number) {
  const t = Math.min(100, Math.max(0.1, top))
  for (let i = 0; i < BANDS.length - 1; i++) {
    if (t <= BANDS[i + 1]) return (i + Math.log(t / BANDS[i]) / Math.log(BANDS[i + 1] / BANDS[i])) / (BANDS.length - 1)
  }
  return 1
}

// Radii in % of the record's width (the record is 100 wide).
const LABEL_R = 16.5 // paper label
const PHOTO_R = 12.2 // the owner's photo, inside the label
const RUNOUT_R = 20 // innermost groove
const OUTER_R = 46 // outermost groove
const ringR = (f: number) => RUNOUT_R + 1.5 + f * (OUTER_R - RUNOUT_R - 3)
/** Track gaps sit on the tier boundaries: each band of the record is a tier. */
const GAPS = BANDS.slice(1, -1).map((t) => ringR(bandRadius(t)))
/** Closer to the centre, bigger: a face's size follows how close it sits, not just its tier. */
const sizeFor = (f: number) => 16.8 - f * 5.6

const hashAngle = (id: string) => {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 360) * (Math.PI / 180)
}

function place(list: Marker[]) {
  const out: (Marker & { x: number; y: number; size: number; close: number })[] = []
  for (const m of [...list].sort((a, b) => a.top - b.top)) {
    const f = bandRadius(m.top)
    const r = ringR(f)
    let a = hashAngle(m.id)
    for (let k = 0; k < 36; k++) {
      const x = 50 + Math.cos(a) * r
      const y = 50 + Math.sin(a) * r
      if (out.every((o) => Math.hypot(o.x - x, o.y - y) > 14)) break
      a += 0.61
    }
    out.push({ ...m, x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r, size: sizeFor(f), close: Math.round((1 - f) * 100) / 100 })
  }
  return out
}

// One revolution every 40 s: slow enough that faces stay readable.
export const DEG_PER_S = 9
/**
 * Where a record playing since the page opened would be now. Every record in
 * CIRCA (this one, and the small one in the tab bar) turns to this clock, so
 * they spin at the same speed and stay in step.
 */
export const clockAngle = () => ((performance.now() / 1000) * DEG_PER_S) % 360
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180
// Tonearm angles (deg) about its pivot: resting on its post, and in the lead-in groove.
const ARM_REST = -7
const ARM_PLAY = 2

const SPIN_UP = 0.32 // s, time constant of the platter coming up to speed
const COAST = 0.6 // s, coasting down
const FLICK = 1.6 // s, a hand-thrown spin fading back to speed

/** Faded out or off screen: it can be repositioned without anyone seeing. */
const unseen = (el: HTMLElement) => {
  const view = el.closest('.view')
  return !view || parseFloat(getComputedStyle(view).opacity) < 0.5
}

/**
 * Turns the platter with some mass: it spins up and coasts down. Arriving on
 * the page, it starts from just the angle where its spin-up lands in step
 * with the shared clock, so it never visibly catches up. You can also take
 * hold of the record and turn it by hand: it follows your finger, keeps the
 * momentum of a flick, then settles back to 33. Writes --rot on the deck.
 */
function usePlatter(deck: RefObject<HTMLDivElement | null>, spinning: boolean) {
  const angle = useRef(-24)
  const speed = useRef(0)
  const want = useRef(spinning)
  const raf = useRef(0)
  /** Where this record sits relative to the shared clock (changes when you turn it by hand). */
  const offset = useRef(0)
  /** Held by a finger: the loop leaves the angle alone. */
  const held = useRef(false)
  /** Just let go of a flick: momentum fades slowly instead of snapping back. */
  const flick = useRef(false)

  const loop = useRef<() => void>(() => {})
  useEffect(() => {
    loop.current = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || raf.current) return
      let last = performance.now()
      const tick = (now: number) => {
        // real elapsed time, so a slow frame never leaves the record behind
        const dt = Math.min(1, (now - last) / 1000)
        last = now
        if (!held.current) {
          const target = want.current ? 1 : 0
          const tau = flick.current ? FLICK : target ? SPIN_UP : COAST
          speed.current += (target - speed.current) * (1 - Math.exp(-dt / tau))
          if (flick.current && Math.abs(speed.current - target) < 0.02) {
            flick.current = false
            // wherever the hand left it becomes its place against the clock
            offset.current = wrap(angle.current - clockAngle())
          }
          angle.current = (angle.current + speed.current * DEG_PER_S * dt) % 360
          // up to speed, drift back onto the clock imperceptibly (a fraction of a degree a second)
          if (want.current && !flick.current && speed.current > 0.98)
            angle.current += wrap(clockAngle() + offset.current - angle.current) * (1 - Math.exp(-dt / 2))
          deck.current?.style.setProperty('--rot', `${angle.current.toFixed(3)}deg`)
          if (!want.current && !flick.current && speed.current < 0.002) {
            speed.current = 0
            raf.current = 0
            return
          }
        }
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    }
  }, [deck])

  useEffect(() => {
    want.current = spinning
    const el = deck.current
    // A spin-up from rest falls DEG_PER_S × SPIN_UP degrees behind the clock; start that far ahead.
    if (spinning && speed.current < 0.01 && el && unseen(el)) {
      offset.current = 0
      angle.current = (clockAngle() + DEG_PER_S * SPIN_UP) % 360
    }
    el?.style.setProperty('--rot', `${angle.current}deg`)
    loop.current()
  }, [deck, spinning])
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      raf.current = 0 // so a remount can start the loop again
    },
    [],
  )

  /** Turning by hand: pointer handlers for the record. A tap still reaches the faces. */
  const g = useRef({ start: null as { x: number; y: number; id: number } | null, cx: 0, cy: 0, lastA: 0, lastT: 0, vel: 0, dragging: false })
  const [handlers] = useState(() => ({
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      if (e.button !== 0) return
      const r = e.currentTarget.getBoundingClientRect()
      const s = g.current
      s.cx = r.left + r.width / 2
      s.cy = r.top + r.height / 2
      s.start = { x: e.clientX, y: e.clientY, id: e.pointerId }
      s.lastA = (Math.atan2(e.clientY - s.cy, e.clientX - s.cx) * 180) / Math.PI
      s.lastT = e.timeStamp
      s.vel = 0
      s.dragging = false
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      const s = g.current
      if (!s.start || e.pointerId !== s.start.id) return
      if (!s.dragging) {
        if (Math.hypot(e.clientX - s.start.x, e.clientY - s.start.y) < 6) return
        s.dragging = true
        held.current = true
        speed.current = 0
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.closest('.hifi')?.classList.add('is-held')
        tick()
      }
      const a = (Math.atan2(e.clientY - s.cy, e.clientX - s.cx) * 180) / Math.PI
      const d = wrap(a - s.lastA)
      const dt = Math.max(1, e.timeStamp - s.lastT) / 1000
      s.vel = s.vel * 0.6 + (d / dt) * 0.4
      s.lastA = a
      s.lastT = e.timeStamp
      angle.current = (angle.current + d) % 360
      e.currentTarget.closest<HTMLElement>('.hifi')?.style.setProperty('--rot', `${angle.current.toFixed(3)}deg`)
    },
    onPointerUp(e: React.PointerEvent<HTMLElement>) {
      const s = g.current
      if (!s.start || e.pointerId !== s.start.id) return
      s.start = null
      if (!s.dragging) return
      held.current = false
      e.currentTarget.closest('.hifi')?.classList.remove('is-held')
      // a flick keeps its momentum (clamped to something a hand could do)
      const still = e.timeStamp - s.lastT > 120
      speed.current = still ? 0 : Math.max(-12, Math.min(12, s.vel / DEG_PER_S))
      flick.current = true
      loop.current()
      // the gesture was a turn, not a tap: keep it from opening a face
      const swallow = (ev: Event) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
    },
    onPointerCancel(e: React.PointerEvent<HTMLElement>) {
      const s = g.current
      s.start = null
      if (!s.dragging) return
      held.current = false
      flick.current = true
      e.currentTarget.closest('.hifi')?.classList.remove('is-held')
      loop.current()
    },
  }))
  return handlers
}

interface Props {
  markers: Marker[]
  /** The owner: photo on the label, name printed round it. */
  owner: { name: string; avatar: string }
  /** Etched into the run-out groove. */
  etching?: string
  spinning: boolean
  onMarker: (id: string) => void
  /** The nameplate: who this is, set into the plinth. */
  children?: ReactNode
  /** Hardware set into the deck beside the record (e.g. the search button). */
  controls?: ReactNode
  className?: string
  /** A creator's own vinyl: pressed on cream, a special edition (artist or podcast). */
  edition?: 'artist' | 'podcast'
  /** Top 1% of listeners this year: a gold ring round the record. */
  gilded?: boolean
  /** Tapping the photo at the centre (your own vinyl: your profile and who's on it). */
  onLabel?: () => void
  labelHint?: string
}

export function Turntable({ markers, owner, etching, spinning, onMarker, children, controls, className, edition, gilded, onLabel, labelHint }: Props) {
  const placed = useMemo(() => place(markers), [markers])
  const deck = useRef<HTMLDivElement>(null)
  const hand = usePlatter(deck, spinning)
  return (
    <div
      ref={deck}
      className={`hifi ${spinning ? 'is-spinning' : ''} ${edition ? `hifi--edition hifi--${edition}` : ''} ${gilded ? 'hifi--gilded' : ''} ${className ?? ''}`}
      style={{ '--arm': `${spinning ? ARM_PLAY : ARM_REST}deg` } as CSSProperties}
    >
      {/* the deck, straight down from above */}
      <div className="hifi__top">
      <div className="hifi__stage">
        <div className="hifi__platter" aria-hidden />
        <div className="hifi__record" {...hand}>
          <div className="hifi__turn" aria-hidden>
            <Disc owner={owner} etching={etching} edition={edition} />
          </div>
          <div className="hifi__sheen" aria-hidden />
          <div className="hifi__turn hifi__faces">
            {placed.map((p) => (
              <button
                key={p.id}
                className={`face-marker ${p.faint ? 'is-faint' : ''} ${p.tier === 'top1' ? 'is-centre' : ''} ${p.shared ? 'is-shared' : ''}`}
                style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}%`, '--close': p.close } as React.CSSProperties}
                onClick={() => onMarker(p.id)}
                aria-label={p.name}
              >
                <span className="face-marker__upright">
                  <img src={p.avatar} alt="" draggable={false} />
                  {p.closer && <i className="face-marker__closer" aria-hidden />}
                  {p.live && <i className="face-marker__pip face-marker__pip--live" aria-hidden><I.Ticket /></i>}
                  {p.favorite && <i className="face-marker__pip face-marker__pip--fav" aria-hidden><I.Spark on /></i>}
                  <span className="face-marker__name" aria-hidden>{p.name}</span>
                </span>
              </button>
            ))}
          </div>
          <span className="hifi__spindle" aria-hidden />
          {onLabel && (
            // the photo at the centre, as a button; it stays still while the record turns under it
            <button
              className="hifi__label-btn"
              style={{ left: `${50 - LABEL_R}%`, top: `${50 - LABEL_R}%`, width: `${LABEL_R * 2}%` }}
              onClick={onLabel}
              aria-label={labelHint ?? owner.name}
            >
              <span className="hifi__label-pip" aria-hidden>
                <I.Edit size={11} />
              </span>
            </button>
          )}
        </div>
        <span className="hifi__rest" aria-hidden />
        <span className="hifi__base" aria-hidden />
        <Tonearm />
      </div>
      {/* hardware in the deck's corners, outside the record's square */}
      {controls}
      </div>
      {/* the cabinet's front, below a brass seam */}
      {children && (
        <div className="hifi__front">
          <div className="hifi__nameplate">{children}</div>
        </div>
      )}
    </div>
  )
}

/** The pressing: grooves, track gaps on the tier boundaries, run-out etching, and the label. */
function Disc({ owner, etching, edition }: { owner: Props['owner']; etching?: string; edition?: Props['edition'] }) {
  const cream = !!edition
  const ink = cream ? '#2c2418' : '#fff'
  // spoken-word pressings have fewer, wider grooves
  const grooves = edition === 'podcast' ? 46 : 90
  const id = useId().replace(/:/g, '')
  const ring = (r: number) => `M 50 ${50 - r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 ${-2 * r}`
  return (
    <svg className="hifi__disc" viewBox="0 0 100 100">
      <defs>
        <radialGradient id={`vb-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={cream ? '#efe7d6' : '#1d1b20'} />
          <stop offset="60%" stopColor={cream ? '#e4d9c2' : '#111013'} />
          <stop offset="97%" stopColor={cream ? '#d4c6aa' : '#0a090b'} />
          <stop offset="100%" stopColor={cream ? '#e9dfca' : '#1a191c'} />
        </radialGradient>
        <radialGradient id={`lp-${id}`} cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor={edition === 'podcast' ? '#b98a6c' : '#1a3b2c'} />
          <stop offset="100%" stopColor={edition === 'podcast' ? '#86604c' : '#0c2017'} />
        </radialGradient>
        <clipPath id={`ph-${id}`}>
          <circle cx="50" cy="50" r={PHOTO_R} />
        </clipPath>
        <path id={`top-${id}`} d={`M ${50 - 14.3} 50 A 14.3 14.3 0 0 1 ${50 + 14.3} 50`} />
        <path id={`bot-${id}`} d={`M ${50 - 15.4} 50 A 15.4 15.4 0 0 0 ${50 + 15.4} 50`} />
        <path id={`etch-${id}`} d={ring(18.2)} />
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#vb-${id})`} />
      {/* the lead-in edge catches a little light */}
      <circle cx="50" cy="50" r="49.7" fill="none" stroke={ink} strokeOpacity=".14" strokeWidth=".25" />
      <circle cx="50" cy="50" r={OUTER_R + 1.4} fill="none" stroke={cream ? '#cbbd9f' : '#050506'} strokeWidth="2.2" />
      {/* fine grooves */}
      {Array.from({ length: grooves }, (_, k) => {
        const r = RUNOUT_R + (k / (grooves - 1)) * (OUTER_R - RUNOUT_R)
        return <circle key={k} cx="50" cy="50" r={r} fill="none" stroke={ink} strokeOpacity={(k % 3 ? 0.028 : 0.05) * (cream ? 2.2 : 1)} strokeWidth={edition === 'podcast' ? '.22' : '.14'} />
      })}
      {/* track gaps: smooth, glossy bands between tiers */}
      {GAPS.map((r) => (
        <g key={r}>
          <circle cx="50" cy="50" r={r} fill="none" stroke={cream ? '#c9b994' : '#060607'} strokeWidth="1.1" />
          <circle cx="50" cy="50" r={r + 0.55} fill="none" stroke={cream ? '#fff' : '#fff'} strokeOpacity={cream ? 0.5 : 0.09} strokeWidth=".12" />
        </g>
      ))}
      {/* run-out, with what this person has lived etched into it */}
      <circle cx="50" cy="50" r={(RUNOUT_R + LABEL_R) / 2} fill="none" stroke={cream ? '#dbcfb6' : '#0b0a0c'} strokeWidth={RUNOUT_R - LABEL_R} />
      {etching && (
        <text className="hifi__etching">
          <textPath href={`#etch-${id}`}>{etching}</textPath>
        </text>
      )}
      {/* the label: the owner's photo in a printed ring */}
      <circle cx="50" cy="50" r={LABEL_R} fill={`url(#lp-${id})`} />
      <circle cx="50" cy="50" r={LABEL_R - 0.5} fill="none" stroke="var(--mustard)" strokeOpacity=".85" strokeWidth=".2" />
      <text className="hifi__print">
        <textPath href={`#top-${id}`} startOffset="50%" textAnchor="middle">{owner.name.toUpperCase()}</textPath>
      </text>
      <text className="hifi__print hifi__print--small">
        <textPath href={`#bot-${id}`} startOffset="50%" textAnchor="middle">
          {edition === 'podcast' ? 'CIRCA · SPOKEN WORD · 33⅓' : edition ? 'CIRCA · SPECIAL EDITION' : 'CIRCA · SIDE A · 33⅓'}
        </textPath>
      </text>
      {owner.avatar ? (
        <image href={owner.avatar} x={50 - PHOTO_R} y={50 - PHOTO_R} width={PHOTO_R * 2} height={PHOTO_R * 2} clipPath={`url(#ph-${id})`} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <circle cx="50" cy="50" r={PHOTO_R} fill="var(--cherry-deep)" />
      )}
      <circle cx="50" cy="50" r={PHOTO_R} fill="none" stroke="var(--mustard)" strokeWidth=".35" />
    </svg>
  )
}

/**
 * The arm, drawn hanging straight down from its pivot (0,0) in stage units
 * (1 unit = 1% of the stage's width). Counterweight above, headshell below.
 */
function Tonearm() {
  const id = useId().replace(/:/g, '')
  return (
    <svg className="hifi__arm" viewBox="-10 -16 20 70" aria-hidden>
      <defs>
        <linearGradient id={`ch-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#5e4a28" />
          <stop offset=".3" stopColor="#e2d1a8" />
          <stop offset=".55" stopColor="#b89c66" />
          <stop offset="1" stopColor="#56432a" />
        </linearGradient>
        <radialGradient id={`cap-${id}`} cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#f6efe0" />
          <stop offset=".45" stopColor="#cbb08a" />
          <stop offset="1" stopColor="#6a4c3c" />
        </radialGradient>
        <linearGradient id={`ct-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#0b1d15" />
          <stop offset=".35" stopColor="#1e3d2f" />
          <stop offset="1" stopColor="#0b1d15" />
        </linearGradient>
      </defs>
      {/* counterweight: a knurled drum */}
      <rect x="-1.1" y="-7" width="2.2" height="6" fill={`url(#ch-${id})`} />
      <rect x="-2.9" y="-14.2" width="5.8" height="7.4" rx=".9" fill={`url(#ch-${id})`} />
      {Array.from({ length: 9 }, (_, k) => (
        <line key={k} x1="-2.9" x2="2.9" y1={-13.4 + k * 0.72} y2={-13.4 + k * 0.72} stroke="#43361f" strokeOpacity=".5" strokeWidth=".12" />
      ))}
      <rect x="-2.9" y="-8.4" width="5.8" height="1.4" rx=".5" fill="#1d1b1e" />
      {/* tube, with a gentle bend into the headshell */}
      <path d="M0 0 L0 37.5 Q0 41.6 -1.6 44" fill="none" stroke="#56432a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M0 0 L0 37.5 Q0 41.6 -1.6 44" fill="none" stroke="#cdb68a" strokeWidth="1.15" strokeLinecap="round" />
      <path d="M-.28 1 L-.28 37.4 Q-.3 41 -1.75 43.2" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth=".32" strokeLinecap="round" />
      {/* gimbal and pivot cap */}
      <circle r="3.3" fill="#1d1b1e" />
      <circle r="2.6" fill={`url(#cap-${id})`} />
      <circle r=".7" fill="#2a2a2e" />
      {/* headshell, cartridge and stylus */}
      <g transform="translate(-1.6 44) rotate(26.6)">
        <rect x="-.95" y="-.6" width="1.9" height="1.4" rx=".3" fill={`url(#ch-${id})`} />
        <path d="M1.4 1.2 Q3.3 1.1 3.7 -.4" fill="none" stroke="#cdb68a" strokeWidth=".5" strokeLinecap="round" />
        <rect x="-1.55" y=".5" width="3.1" height="5.8" rx=".45" fill="#1b191c" />
        <rect x="-1.55" y=".5" width="3.1" height=".5" rx=".25" fill="#fff" fillOpacity=".18" />
        <rect x="-1.12" y="2" width="2.24" height="4" rx=".3" fill={`url(#ct-${id})`} />
        <rect x="-1.12" y="5.4" width="2.24" height=".35" fill="var(--mustard)" />
        <path d="M-.35 6 L.35 6 L0 6.6 Z" fill="#e9e5dc" />
      </g>
    </svg>
  )
}
