import { useEffect, useId, useMemo, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type { TierId } from '../lib/affinity'
import * as I from './Icons'

/**
 * A record player seen from above. The record is someone's vinyl: their
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
const SIZE: Record<TierId, number> = { top1: 15.5, inner: 14, devoted: 13, regular: 12, discovered: 12 }

const hashAngle = (id: string) => {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 360) * (Math.PI / 180)
}

function place(list: Marker[]) {
  const out: (Marker & { x: number; y: number; size: number })[] = []
  for (const m of [...list].sort((a, b) => a.top - b.top)) {
    const r = ringR(bandRadius(m.top))
    let a = hashAngle(m.id)
    for (let k = 0; k < 36; k++) {
      const x = 50 + Math.cos(a) * r
      const y = 50 + Math.sin(a) * r
      if (out.every((o) => Math.hypot(o.x - x, o.y - y) > 14)) break
      a += 0.61
    }
    out.push({ ...m, x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r, size: SIZE[m.tier] })
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

/** Faded out or off screen: it can be repositioned without anyone seeing. */
const unseen = (el: HTMLElement) => {
  const view = el.closest('.view')
  return !view || parseFloat(getComputedStyle(view).opacity) < 0.5
}

/**
 * Turns the platter with some mass: it spins up and coasts down. Arriving on
 * the page, it starts from just the angle where its spin-up lands in step
 * with the shared clock, so it never visibly catches up. Writes --rot on the
 * deck; CSS does the rest.
 */
function usePlatter(deck: RefObject<HTMLDivElement | null>, spinning: boolean) {
  const angle = useRef(-24)
  const speed = useRef(0)
  const want = useRef(spinning)
  const raf = useRef(0)
  useEffect(() => {
    want.current = spinning
    const el = deck.current
    // A spin-up from rest falls DEG_PER_S × SPIN_UP degrees behind the clock; start that far ahead.
    if (spinning && speed.current < 0.01 && el && unseen(el)) angle.current = (clockAngle() + DEG_PER_S * SPIN_UP) % 360
    el?.style.setProperty('--rot', `${angle.current}deg`)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || raf.current) return
    let last = performance.now()
    const tick = (now: number) => {
      // real elapsed time, so a slow frame never leaves the record behind
      const dt = Math.min(1, (now - last) / 1000)
      last = now
      const target = want.current ? 1 : 0
      speed.current += (target - speed.current) * (1 - Math.exp(-dt / (target ? SPIN_UP : COAST)))
      angle.current = (angle.current + speed.current * DEG_PER_S * dt) % 360
      // up to speed, drift back onto the clock imperceptibly (a fraction of a degree a second)
      if (want.current && speed.current > 0.98) angle.current += wrap(clockAngle() - angle.current) * (1 - Math.exp(-dt / 2))
      deck.current?.style.setProperty('--rot', `${angle.current.toFixed(3)}deg`)
      if (!want.current && speed.current < 0.002) {
        speed.current = 0
        raf.current = 0
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [deck, spinning])
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      raf.current = 0 // so a remount can start the loop again
    },
    [],
  )
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
  className?: string
}

export function Turntable({ markers, owner, etching, spinning, onMarker, children, className }: Props) {
  const placed = useMemo(() => place(markers), [markers])
  const deck = useRef<HTMLDivElement>(null)
  usePlatter(deck, spinning)
  return (
    <div
      ref={deck}
      className={`hifi ${spinning ? 'is-spinning' : ''} ${className ?? ''}`}
      style={{ '--arm': `${spinning ? ARM_PLAY : ARM_REST}deg` } as CSSProperties}
    >
      <div className="hifi__stage">
        <div className="hifi__platter" aria-hidden />
        <div className="hifi__record">
          <div className="hifi__turn" aria-hidden>
            <Disc owner={owner} etching={etching} />
          </div>
          <div className="hifi__sheen" aria-hidden />
          <div className="hifi__turn hifi__faces">
            {placed.map((p) => (
              <button
                key={p.id}
                className={`face-marker ${p.faint ? 'is-faint' : ''} ${p.tier === 'top1' ? 'is-centre' : ''} ${p.shared ? 'is-shared' : ''}`}
                style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}%` }}
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
        </div>
        <span className="hifi__rest" aria-hidden />
        <span className="hifi__base" aria-hidden />
        <Tonearm />
      </div>
      {children && <div className="hifi__nameplate">{children}</div>}
    </div>
  )
}

/** The pressing: grooves, track gaps on the tier boundaries, run-out etching, and the label. */
function Disc({ owner, etching }: { owner: Props['owner']; etching?: string }) {
  const id = useId().replace(/:/g, '')
  const ring = (r: number) => `M 50 ${50 - r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 ${-2 * r}`
  return (
    <svg className="hifi__disc" viewBox="0 0 100 100">
      <defs>
        <radialGradient id={`vb-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1d1b20" />
          <stop offset="60%" stopColor="#111013" />
          <stop offset="97%" stopColor="#0a090b" />
          <stop offset="100%" stopColor="#1a191c" />
        </radialGradient>
        <radialGradient id={`lp-${id}`} cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#d3283b" />
          <stop offset="100%" stopColor="#a8192b" />
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
      <circle cx="50" cy="50" r="49.7" fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth=".25" />
      <circle cx="50" cy="50" r={OUTER_R + 1.4} fill="none" stroke="#050506" strokeWidth="2.2" />
      {/* fine grooves */}
      {Array.from({ length: 90 }, (_, k) => {
        const r = RUNOUT_R + (k / 89) * (OUTER_R - RUNOUT_R)
        return <circle key={k} cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeOpacity={k % 3 ? 0.028 : 0.05} strokeWidth=".14" />
      })}
      {/* track gaps: smooth, glossy bands between tiers */}
      {GAPS.map((r) => (
        <g key={r}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="#060607" strokeWidth="1.1" />
          <circle cx="50" cy="50" r={r + 0.55} fill="none" stroke="#fff" strokeOpacity=".09" strokeWidth=".12" />
        </g>
      ))}
      {/* run-out, with what this person has lived etched into it */}
      <circle cx="50" cy="50" r={(RUNOUT_R + LABEL_R) / 2} fill="none" stroke="#0b0a0c" strokeWidth={RUNOUT_R - LABEL_R} />
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
        <textPath href={`#bot-${id}`} startOffset="50%" textAnchor="middle">CIRCA · SIDE A · 33⅓</textPath>
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
          <stop offset="0" stopColor="#6d6f75" />
          <stop offset=".3" stopColor="#f4f4f2" />
          <stop offset=".55" stopColor="#b9bbc0" />
          <stop offset="1" stopColor="#575960" />
        </linearGradient>
        <radialGradient id={`cap-${id}`} cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#c7c9cd" />
          <stop offset="1" stopColor="#5b5d63" />
        </radialGradient>
        <linearGradient id={`ct-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#8f1424" />
          <stop offset=".35" stopColor="#d9334a" />
          <stop offset="1" stopColor="#8f1424" />
        </linearGradient>
      </defs>
      {/* counterweight: a knurled drum */}
      <rect x="-1.1" y="-7" width="2.2" height="6" fill={`url(#ch-${id})`} />
      <rect x="-2.9" y="-14.2" width="5.8" height="7.4" rx=".9" fill={`url(#ch-${id})`} />
      {Array.from({ length: 9 }, (_, k) => (
        <line key={k} x1="-2.9" x2="2.9" y1={-13.4 + k * 0.72} y2={-13.4 + k * 0.72} stroke="#3a3b40" strokeOpacity=".45" strokeWidth=".12" />
      ))}
      <rect x="-2.9" y="-8.4" width="5.8" height="1.4" rx=".5" fill="#1d1b1e" />
      {/* tube, with a gentle bend into the headshell */}
      <path d="M0 0 L0 37.5 Q0 41.6 -1.6 44" fill="none" stroke="#4d4f55" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M0 0 L0 37.5 Q0 41.6 -1.6 44" fill="none" stroke="#c9cbcf" strokeWidth="1.15" strokeLinecap="round" />
      <path d="M-.28 1 L-.28 37.4 Q-.3 41 -1.75 43.2" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth=".32" strokeLinecap="round" />
      {/* gimbal and pivot cap */}
      <circle r="3.3" fill="#1d1b1e" />
      <circle r="2.6" fill={`url(#cap-${id})`} />
      <circle r=".7" fill="#2a2a2e" />
      {/* headshell, cartridge and stylus */}
      <g transform="translate(-1.6 44) rotate(26.6)">
        <rect x="-.95" y="-.6" width="1.9" height="1.4" rx=".3" fill={`url(#ch-${id})`} />
        <path d="M1.4 1.2 Q3.3 1.1 3.7 -.4" fill="none" stroke="#c9cbcf" strokeWidth=".5" strokeLinecap="round" />
        <rect x="-1.55" y=".5" width="3.1" height="5.8" rx=".45" fill="#1b191c" />
        <rect x="-1.55" y=".5" width="3.1" height=".5" rx=".25" fill="#fff" fillOpacity=".18" />
        <rect x="-1.12" y="2" width="2.24" height="4" rx=".3" fill={`url(#ct-${id})`} />
        <rect x="-1.12" y="5.4" width="2.24" height=".35" fill="var(--mustard)" />
        <path d="M-.35 6 L.35 6 L0 6.6 Z" fill="#e9e5dc" />
      </g>
    </svg>
  )
}
