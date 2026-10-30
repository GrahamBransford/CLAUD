import { useEffect, useMemo, useRef } from 'react'
import { brand } from '../config/brand'
import { creatorById } from '../data'
import { useUniverse } from '../hooks/useRelationship'
import { formatTop, type Relationship } from '../lib/affinity'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'

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
const RUNOUT_R = 20 // innermost groove
const OUTER_R = 46 // outermost groove
const ringR = (f: number) => RUNOUT_R + 1.5 + f * (OUTER_R - RUNOUT_R - 3)

const hashAngle = (id: string) => {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 360) * (Math.PI / 180)
}

interface Placed {
  rel: Relationship
  x: number
  y: number
  size: number
  closer: boolean
}

function place(list: Relationship[], lastTop: Record<string, number>): Placed[] {
  const out: Placed[] = []
  for (const rel of list) {
    const r = ringR(bandRadius(rel.top))
    let a = hashAngle(rel.creatorId)
    for (let k = 0; k < 36; k++) {
      const x = 50 + Math.cos(a) * r
      const y = 50 + Math.sin(a) * r
      if (out.every((o) => Math.hypot(o.x - x, o.y - y) > 14)) break
      a += 0.61
    }
    const prev = lastTop[rel.creatorId]
    out.push({
      rel,
      x: 50 + Math.cos(a) * r,
      y: 50 + Math.sin(a) * r,
      size: rel.tier.id === 'top1' ? 15.5 : rel.tier.id === 'inner' ? 14 : rel.tier.id === 'devoted' ? 13 : 12,
      closer: !!prev && prev - rel.top > 0.05,
    })
  }
  return out
}

/** Track gaps sit on the tier boundaries: each band of the record is a tier. */
const GAPS = BANDS.slice(1, -1).map((t) => ringR(bandRadius(t)))

// One revolution every 40 s: slow enough that faces stay readable.
const DEG_PER_S = 9
// Tonearm angles (deg) about its pivot: resting on its post, and in the lead-in groove.
const ARM_REST = -13
const ARM_PLAY = 2.5

/**
 * Turns the platter with some mass: it spins up, coasts down, and the angle
 * carries over between visits. Writes --rot on the deck; CSS does the rest.
 */
function usePlatter(deck: React.RefObject<HTMLDivElement | null>, spinning: boolean) {
  const angle = useRef(-24)
  const speed = useRef(0)
  const want = useRef(spinning)
  const raf = useRef(0)
  useEffect(() => {
    want.current = spinning
    deck.current?.style.setProperty('--rot', `${angle.current}deg`)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || raf.current) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const target = want.current ? 1 : 0
      // spin-up ~0.8 s, coast-down ~1.6 s
      speed.current += (target - speed.current) * (1 - Math.exp(-dt / (target ? 0.32 : 0.6)))
      angle.current = (angle.current + speed.current * DEG_PER_S * dt) % 360
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
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
}

/** Your record: everyone you listen to, set into the grooves by how close you are. */
export function YourRecord({ active }: { active: boolean }) {
  const all = useUniverse()
  const lastTop = useStore((s) => s.lastTop)
  const setLastTop = useStore((s) => s.setLastTop)
  const sheet = useUI((s) => s.sheet)
  const placed = useMemo(() => place(all, lastTop), [all, lastTop])
  const deck = useRef<HTMLDivElement>(null)
  const spinning = active && !sheet
  usePlatter(deck, spinning)

  // When you leave, remember where everyone was, so moving closer is visible next time.
  const latest = useRef(all)
  useEffect(() => {
    latest.current = all
  }, [all])
  useEffect(() => {
    if (!active) setLastTop(Object.fromEntries(latest.current.map((r) => [r.creatorId, r.top])))
  }, [active, setLastTop])

  return (
    <section className="screen screen--record" aria-label={brand.home.label}>
      <div ref={deck} className={`hifi ${spinning ? 'is-spinning' : ''}`} style={{ '--arm': `${spinning ? ARM_PLAY : ARM_REST}deg` } as React.CSSProperties}>
        <div className="hifi__plate" aria-hidden />
        <div className="hifi__platter" aria-hidden />

        <div className="hifi__record">
          <div className="hifi__turn" aria-hidden>
            <Disc />
          </div>
          <div className="hifi__sheen" aria-hidden />
          <div className="hifi__turn hifi__faces">
            {placed.map((p) => {
              const c = creatorById[p.rel.creatorId]
              return (
                <button
                  key={p.rel.creatorId}
                  className={`face-marker ${p.rel.followed ? '' : 'is-faint'} ${p.rel.tier.id === 'top1' ? 'is-centre' : ''}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}%` }}
                  onClick={() => useUI.getState().openSheet({ kind: 'creator', creatorId: p.rel.creatorId })}
                  aria-label={`${c?.name}, ${formatTop(p.rel.top)} of listeners`}
                >
                  <span className="face-marker__upright">
                    <img src={c?.avatar} alt="" draggable={false} />
                    {p.closer && <i className="face-marker__closer" aria-hidden />}
                  </span>
                </button>
              )
            })}
          </div>
          <span className="hifi__spindle" aria-hidden />
        </div>

        <span className="hifi__rest" aria-hidden />
        <span className="hifi__base" aria-hidden />
        <Tonearm />

        <button className="hifi__knob" onClick={() => useUI.getState().openSheet({ kind: 'settings' })} aria-label="Settings">
          <span />
        </button>
        <span className="hifi__lamp" aria-hidden />
      </div>
    </section>
  )
}

/** The pressing: grooves, track gaps on the tier boundaries, run-out, and the label. */
function Disc() {
  return (
    <svg className="hifi__disc" viewBox="0 0 100 100">
      <defs>
        <radialGradient id="vinyl-body" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1d1b20" />
          <stop offset="60%" stopColor="#111013" />
          <stop offset="97%" stopColor="#0a090b" />
          <stop offset="100%" stopColor="#1a191c" />
        </radialGradient>
        <radialGradient id="label-paper" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#d3283b" />
          <stop offset="100%" stopColor="#a8192b" />
        </radialGradient>
        <path id="label-arc-top" d="M 37.2 50 A 12.8 12.8 0 0 1 62.8 50" />
        <path id="label-arc-bottom" d="M 36 50 A 14 14 0 0 0 64 50" />
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#vinyl-body)" />
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
      {/* run-out and lock groove */}
      <circle cx="50" cy="50" r={(RUNOUT_R + LABEL_R) / 2} fill="none" stroke="#0b0a0c" strokeWidth={RUNOUT_R - LABEL_R} />
      <circle cx="50" cy="50" r={LABEL_R + 1.4} fill="none" stroke="#fff" strokeOpacity=".07" strokeWidth=".15" />
      {/* the label */}
      <circle cx="50" cy="50" r={LABEL_R} fill="url(#label-paper)" />
      <circle cx="50" cy="50" r={LABEL_R - 1.1} fill="none" stroke="var(--mustard)" strokeOpacity=".85" strokeWidth=".22" />
      <circle cx="50" cy="50" r={LABEL_R - 1.6} fill="none" stroke="var(--mustard)" strokeOpacity=".5" strokeWidth=".1" />
      <text className="hifi__wordmark" x="50" y="46.2" textAnchor="middle">{brand.name.toUpperCase()}</text>
      <line x1="44" x2="56" y1="47.6" y2="47.6" stroke="var(--mustard)" strokeWidth=".14" strokeOpacity=".8" />
      <text className="hifi__print" x="50" y="58" textAnchor="middle">SIDE A</text>
      <text className="hifi__print hifi__print--arc">
        <textPath href="#label-arc-bottom" startOffset="50%" textAnchor="middle">HIGH FIDELITY · LONG PLAYING</textPath>
      </text>
      <text className="hifi__print hifi__print--arc">
        <textPath href="#label-arc-top" startOffset="50%" textAnchor="middle">33⅓</textPath>
      </text>
    </svg>
  )
}

/**
 * The arm, drawn hanging straight down from its pivot (0,0) in deck units
 * (1 unit = 1% of the deck's width). Counterweight above, headshell below.
 */
function Tonearm() {
  return (
    <svg className="hifi__arm" viewBox="-10 -16 20 70" aria-hidden>
      <defs>
        <linearGradient id="arm-chrome" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#6d6f75" />
          <stop offset=".3" stopColor="#f4f4f2" />
          <stop offset=".55" stopColor="#b9bbc0" />
          <stop offset="1" stopColor="#575960" />
        </linearGradient>
        <radialGradient id="arm-cap" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#c7c9cd" />
          <stop offset="1" stopColor="#5b5d63" />
        </radialGradient>
        <linearGradient id="cart" x1="0" x2="1">
          <stop offset="0" stopColor="#8f1424" />
          <stop offset=".35" stopColor="#d9334a" />
          <stop offset="1" stopColor="#8f1424" />
        </linearGradient>
      </defs>
      {/* counterweight: a knurled drum */}
      <rect x="-1.1" y="-7" width="2.2" height="6" fill="url(#arm-chrome)" />
      <rect x="-2.9" y="-14.2" width="5.8" height="7.4" rx=".9" fill="url(#arm-chrome)" />
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
      <circle r="2.6" fill="url(#arm-cap)" />
      <circle r=".7" fill="#2a2a2e" />
      {/* headshell, cartridge and stylus */}
      <g transform="translate(-1.6 44) rotate(26.6)">
        <rect x="-.95" y="-.6" width="1.9" height="1.4" rx=".3" fill="url(#arm-chrome)" />
        <path d="M1.4 1.2 Q3.3 1.1 3.7 -.4" fill="none" stroke="#c9cbcf" strokeWidth=".5" strokeLinecap="round" />
        <rect x="-1.55" y=".5" width="3.1" height="5.8" rx=".45" fill="#1b191c" />
        <rect x="-1.55" y=".5" width="3.1" height=".5" rx=".25" fill="#fff" fillOpacity=".18" />
        <rect x="-1.12" y="2" width="2.24" height="4" rx=".3" fill="url(#cart)" />
        <rect x="-1.12" y="5.4" width="2.24" height=".35" fill="var(--mustard)" />
        <path d="M-.35 6 L.35 6 L0 6.6 Z" fill="#e9e5dc" />
      </g>
    </svg>
  )
}
