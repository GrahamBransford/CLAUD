import { Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { brand } from '../config/brand'
import { creatorById } from '../data'
import { useUniverse } from '../hooks/useRelationship'
import { formatTop, TIERS, type Relationship } from '../lib/affinity'
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

const LABEL_R = 16 // centre label, % of record width
const OUTER_R = 46.5
const ringR = (f: number) => LABEL_R + 3.5 + f * (OUTER_R - LABEL_R - 3.5)

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
      if (out.every((o) => Math.hypot(o.x - x, o.y - y) > 10)) break
      a += 0.61
    }
    const prev = lastTop[rel.creatorId]
    out.push({
      rel,
      x: 50 + Math.cos(a) * r,
      y: 50 + Math.sin(a) * r,
      size: rel.tier.id === 'top1' ? 12 : rel.tier.id === 'inner' ? 10.5 : rel.tier.id === 'devoted' ? 9.5 : 8.5,
      closer: !!prev && prev - rel.top > 0.05,
    })
  }
  return out
}

/** Your record: everyone you listen to, placed in the grooves by how close you are. */
export function YourRecord({ active }: { active: boolean }) {
  const all = useUniverse()
  const lastTop = useStore((s) => s.lastTop)
  const setLastTop = useStore((s) => s.setLastTop)
  const sheet = useUI((s) => s.sheet)
  const placed = useMemo(() => place(all, lastTop), [all, lastTop])

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
      <button className="record-settings" onClick={() => useUI.getState().openSheet({ kind: 'settings' })} aria-label="Settings">
        <Settings2 size={20} />
      </button>
      <div className="deck">
        <div className={`record ${active && !sheet ? 'is-spinning' : ''}`}>
          <div className="record__spin">
            <svg className="record__disc" viewBox="0 0 100 100" aria-hidden>
              <defs>
                <radialGradient id="vinyl" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1c1a1f" />
                  <stop offset="72%" stopColor="#0f0e11" />
                  <stop offset="100%" stopColor="#070608" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="49.6" fill="url(#vinyl)" />
              {Array.from({ length: 64 }, (_, k) => (
                <circle key={k} cx="50" cy="50" r={LABEL_R + 1.4 + (k / 63) * (OUTER_R + 2 - LABEL_R - 1.4)} fill="none" stroke="#fff" strokeOpacity={k % 8 === 0 ? 0.06 : 0.025} strokeWidth="0.12" />
              ))}
              {TIERS.slice(0, -1).map((t) => (
                <circle key={t.id} cx="50" cy="50" r={ringR(bandRadius(t.maxTop))} fill="none" stroke="#fff" strokeOpacity="0.09" strokeWidth="0.2" />
              ))}
              <circle cx="50" cy="50" r={LABEL_R} fill="var(--cherry)" />
              <circle cx="50" cy="50" r={LABEL_R - 1.4} fill="none" stroke="var(--mustard)" strokeOpacity="0.8" strokeWidth="0.3" />
              <text x="50" y="44" textAnchor="middle" className="record__wordmark">{brand.name}</text>
              <rect x="49.4" y="54" width="1.2" height="4" rx="0.6" fill="var(--mustard)" />
              <circle cx="50" cy="50" r="1.1" fill="var(--espresso)" />
            </svg>
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
                    <img src={c?.avatar} alt="" />
                    {p.closer && <i className="face-marker__closer" aria-hidden />}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="record__sheen" aria-hidden />
          <svg className="record__arm" viewBox="0 0 60 130" aria-hidden>
            <circle cx="44" cy="14" r="10" fill="#2b2420" />
            <circle cx="44" cy="14" r="6" fill="var(--cream-2)" />
            <path d="M44 14 L40 96 L29 113" stroke="var(--cream-2)" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <rect x="21" y="108" width="14" height="9" rx="2" transform="rotate(-32 28 112)" fill="var(--cherry)" />
          </svg>
        </div>
      </div>
    </section>
  )
}
