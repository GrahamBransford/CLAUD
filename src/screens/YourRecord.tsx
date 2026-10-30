import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Mic2, Music2, Pause, Play, Ticket, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RewardCard, TierBadge, TierLadder } from '../components/Tier'
import { brand } from '../config/brand'
import { creatorById, episodes, songs } from '../data'
import { useUniverse } from '../hooks/useRelationship'
import { formatTop, SIGNAL_LABELS, standing, TIERS, type Relationship } from '../lib/affinity'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { useFollow } from './InnerCircle'

/** Equal-width bands for each tier, log-scaled inside a band. Centre = top 0.1%. */
const BANDS = [0.1, 1, 5, 20, 50, 100]
export function bandRadius(top: number) {
  const t = Math.min(100, Math.max(0.1, top))
  for (let i = 0; i < BANDS.length - 1; i++) {
    if (t <= BANDS[i + 1]) {
      const f = Math.log(t / BANDS[i]) / Math.log(BANDS[i + 1] / BANDS[i])
      return (i + f) / (BANDS.length - 1)
    }
  }
  return 1
}

/** Geometry of the record, in percent of the record's width. */
const LABEL_R = 17 // centre label radius
const OUTER_R = 47 // last playable groove
const ringR = (frac: number) => LABEL_R + 3 + frac * (OUTER_R - LABEL_R - 3)

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
  moved: number
}

/** Spread markers so neighbours on the same band don't collide. */
function place(list: Relationship[]): Placed[] {
  const lastTop = useStore.getState().lastTop
  const out: Placed[] = []
  list.forEach((rel) => {
    const r = ringR(bandRadius(rel.top))
    let a = hashAngle(rel.creatorId)
    for (let k = 0; k < 36; k++) {
      const x = 50 + Math.cos(a) * r
      const y = 50 + Math.sin(a) * r
      if (out.every((o) => Math.hypot(o.x - x, o.y - y) > 9.5)) break
      a += 0.61
    }
    const prev = lastTop[rel.creatorId]
    out.push({
      rel,
      x: 50 + Math.cos(a) * r,
      y: 50 + Math.sin(a) * r,
      size: rel.tier.id === 'top1' ? 11.5 : rel.tier.id === 'inner' ? 10 : rel.tier.id === 'devoted' ? 9 : 8,
      moved: prev ? prev - rel.top : 0,
    })
  })
  return out
}

export function YourRecord({ active }: { active: boolean }) {
  const all = useUniverse()
  const setLastTop = useStore((s) => s.setLastTop)
  const [selected, setSelected] = useState<string | null>(null)
  const [spin, setSpin] = useState(true)
  const placed = useMemo(() => place(all), [all])
  const sel = placed.find((p) => p.rel.creatorId === selected)

  // Remember positions when leaving, so the next visit can show who moved closer.
  const latest = useRef(all)
  useEffect(() => {
    latest.current = all
  }, [all])
  useEffect(() => {
    if (active) return
    setLastTop(Object.fromEntries(latest.current.map((r) => [r.creatorId, r.top])))
  }, [active, setLastTop])

  const counts = TIERS.map((t) => ({ t, n: all.filter((r) => r.tier.id === t.id).length }))
  const closest = all.slice(0, 3)
  const growing = placed.filter((p) => p.moved > 0.05).sort((a, b) => b.moved - a.moved).slice(0, 3)
  const couldBe = all.filter((r) => r.followed && (r.tier.id === 'discovered' || r.tier.id === 'regular')).slice(0, 3)

  return (
    <section className="record-page" aria-label={brand.home.label}>
      <div className="record-page__layout">
        <div className="record-wrap">
          <div className={`record ${spin && !selected ? 'is-spinning' : ''}`} onClick={() => setSelected(null)}>
            <div className="record__shadow" aria-hidden />
            <div className="record__spin">
              <svg className="record__disc" viewBox="0 0 100 100" aria-hidden>
                <defs>
                  <radialGradient id="vinyl" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#1d1b20" />
                    <stop offset="70%" stopColor="#0f0e11" />
                    <stop offset="100%" stopColor="#060507" />
                  </radialGradient>
                  {TIERS.map((t) => {
                    const r = ringR(bandRadius(t.maxTop)) - 1.4
                    return <path key={t.id} id={`ring-${t.id}`} d={`M ${50 - r} 50 a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 ${-2 * r} 0`} />
                  })}
                </defs>
                <circle cx="50" cy="50" r="49.6" fill="url(#vinyl)" />
                {Array.from({ length: 70 }, (_, k) => {
                  const r = LABEL_R + 1.5 + (k / 69) * (OUTER_R + 1.8 - LABEL_R - 1.5)
                  return <circle key={k} cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeOpacity={k % 7 === 0 ? 0.07 : 0.03} strokeWidth={0.12} />
                })}
                {TIERS.map((t) => (
                  <circle key={t.id} cx="50" cy="50" r={ringR(bandRadius(t.maxTop))} fill="none" stroke="var(--mustard)" strokeOpacity={0.32} strokeWidth={0.22} strokeDasharray="0.6 0.9" />
                ))}
                {/* each ring is labelled with the band just inside it */}
                {TIERS.map((t, k) => (
                  <text key={t.id} className="record__ringlabel">
                    <textPath href={`#ring-${t.id}`} startOffset={`${70 - k * 3}%`}>{t.label.toUpperCase()}</textPath>
                  </text>
                ))}
                <circle cx="50" cy="50" r={OUTER_R + 2.2} fill="none" stroke="#fff" strokeOpacity="0.06" strokeWidth="0.5" />
                {/* centre label */}
                <circle cx="50" cy="50" r={LABEL_R} fill="var(--cherry)" />
                <circle cx="50" cy="50" r={LABEL_R - 1.3} fill="none" stroke="var(--mustard)" strokeWidth="0.35" />
                <path id="label-arc" d={`M ${50 - 11} 50 a 11 11 0 1 1 22 0`} fill="none" />
                <text className="record__labeltext">
                  <textPath href="#label-arc" startOffset="50%" textAnchor="middle">{brand.name} · SIDE A · 33⅓</textPath>
                </text>
                <text x="50" y="58.5" textAnchor="middle" className="record__labelsmall">THE CENTRE</text>
                <circle cx="50" cy="50" r="1.2" fill="#0a090b" />
              </svg>
              {placed.map((p) => (
                <button
                  key={p.rel.creatorId}
                  className={`marker marker--${creatorById[p.rel.creatorId]?.kind} ${p.rel.followed ? '' : 'is-unfollowed'} ${selected === p.rel.creatorId ? 'is-selected' : ''}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}%` }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(p.rel.creatorId === selected ? null : p.rel.creatorId)
                  }}
                  aria-label={`${creatorById[p.rel.creatorId]?.name}: ${p.rel.tier.label}, ${formatTop(p.rel.top)} of listeners`}
                >
                  <span className="marker__upright">
                    <img src={creatorById[p.rel.creatorId]?.avatar} alt="" />
                    {p.moved > 0.05 && <i className="marker__moved" title="Moved closer since your last visit"><ArrowUpRight size={10} /></i>}
                  </span>
                </button>
              ))}
            </div>
            <div className="record__sheen" aria-hidden />
            <svg className="record__arm" viewBox="0 0 60 120" aria-hidden>
              <circle cx="44" cy="14" r="9" fill="var(--cream-3)" />
              <circle cx="44" cy="14" r="4" fill="var(--ink-2)" />
              <path d="M44 14 L40 92 L30 108" stroke="var(--cream-2)" strokeWidth="3" fill="none" strokeLinecap="round" />
              <rect x="22" y="104" width="13" height="8" rx="2" transform="rotate(-30 28 108)" fill="var(--mustard)" />
            </svg>
          </div>
          <div className="record-wrap__controls">
            <button className="chip-btn chip-btn--on-dark" onClick={() => setSpin((s) => !s)}>
              {spin ? <Pause size={14} /> : <Play size={14} />} <span>{spin ? 'Stop the turntable' : 'Spin'}</span>
            </button>
            <span className="record-legend">
              <i className="dot dot--artist" /> Artist <i className="dot dot--podcast" /> Podcast <i className="dot dot--ghost" /> Not followed
            </span>
          </div>
        </div>

        <aside className="record-side">
          <header className="record-page__head">
            <p className="eyebrow">{brand.home.label} · side A</p>
            <h1>Everyone you listen to, placed by how close you are.</h1>
            <p className="record-page__dek">
              New discoveries start at the outer edge. Listen, come back, save, go to the show, and they move toward the centre.
            </p>
          </header>
          <AnimatePresence mode="wait">
            {sel ? (
              <motion.div key={sel.rel.creatorId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <CreatorDetail rel={sel.rel} moved={sel.moved} onClose={() => setSelected(null)} />
              </motion.div>
            ) : (
              <motion.div key="overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="overview">
                <div className="overview__tiers">
                  {counts.map(({ t, n }) => (
                    <div key={t.id} className={`overview__tier ${n ? '' : 'is-empty'}`}>
                      <TierBadge tier={t.id} size="sm" />
                      <span>{t.label}</span>
                      <strong>{n}</strong>
                    </div>
                  ))}
                </div>
                <Group title="Closest to you" items={closest} onPick={setSelected} />
                {growing.length > 0 && <Group title="Moving closer" items={growing.map((g) => g.rel)} onPick={setSelected} />}
                {couldBe.length > 0 && <Group title="Could be closer" items={couldBe} onPick={setSelected} hint />}
                <p className="fine fine--dark">
                  Percentiles are estimates simulated from listening on this device (plus a demo history standing in for
                  connected streaming services). They are not verified rankings.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </section>
  )
}

function Group({ title, items, onPick, hint }: { title: string; items: Relationship[]; onPick: (id: string) => void; hint?: boolean }) {
  return (
    <div className="group">
      <p className="eyebrow">{title}</p>
      <ul>
        {items.map((r) => {
          const c = creatorById[r.creatorId]
          return (
            <li key={r.creatorId}>
              <button onClick={() => onPick(r.creatorId)}>
                <img src={c?.avatar} alt="" />
                <span>
                  <strong>{c?.name}</strong>
                  <em>{hint && r.next ? `${r.next.hint} to reach ${r.next.tier.label}` : standing(r)}</em>
                </span>
                <TierBadge tier={r.tier.id} size="sm" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function CreatorDetail({ rel, moved = 0, onClose }: { rel: Relationship; moved?: number; onClose?: () => void }) {
  const c = creatorById[rel.creatorId]
  const recordConcert = useStore((s) => s.recordConcert)
  const pushToast = useUI((s) => s.pushToast)
  const follow = useFollow()
  if (!c) return null
  const firstSong = songs.find((s) => s.creatorId === c.id)
  const firstEp = episodes.find((e) => e.creatorId === c.id)
  const listen = () => {
    if (firstSong) {
      useStore.getState().setArtistsIndex(songs.indexOf(firstSong))
      window.location.hash = 'artists'
    } else if (firstEp) {
      useStore.getState().setPodcastsIndex(episodes.indexOf(firstEp))
      window.location.hash = 'podcasts'
    }
  }
  const stats: [string, number][] = [
    [SIGNAL_LABELS.minutes, Math.round(rel.signals.minutes)],
    [SIGNAL_LABELS.completions, rel.signals.completions],
    [SIGNAL_LABELS.repeats, rel.signals.repeats],
    [SIGNAL_LABELS.saves, rel.signals.saves],
    [SIGNAL_LABELS.concerts, rel.signals.concerts],
    [SIGNAL_LABELS.views, rel.signals.views],
  ]
  const nextPct = rel.next ? Math.max(4, Math.min(96, 100 - (rel.next.pointsNeeded / (rel.points + rel.next.pointsNeeded)) * 100)) : 100
  return (
    <div className={`detail detail--${rel.tier.id}`}>
      {onClose && (
        <button className="detail__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      )}
      <div className="detail__head">
        <img src={c.avatar} alt="" />
        <div>
          <span className={`kind kind--${c.kind}`}>{c.kind === 'artist' ? <Music2 size={11} /> : <Mic2 size={11} />} {c.kind === 'artist' ? 'Artist' : 'Podcast'}</span>
          <h2>{c.name}</h2>
          <p>{c.genre}</p>
        </div>
      </div>
      <div className="detail__tier">
        <TierBadge tier={rel.tier.id} size="lg" />
        <div>
          <p className="detail__pct">
            You&rsquo;re in the <strong>{formatTop(rel.top).toLowerCase()}</strong> of {c.name}&rsquo;s listeners.
          </p>
          <p className="detail__line">{rel.tier.line}{moved > 0.05 ? ' You moved closer since your last visit.' : ''}</p>
          <p className="fine fine--dark">Estimate, simulated locally. Not a verified ranking.</p>
        </div>
      </div>
      <TierLadder rel={rel} />
      {rel.next && (
        <div className="detail__next">
          <div className="detail__bar"><span style={{ width: `${nextPct}%` }} /></div>
          <p>Next: <strong>{rel.next.tier.label}</strong>, {rel.next.hint}.</p>
        </div>
      )}
      <dl className="detail__stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="detail__actions">
        {(firstSong || firstEp) && <button className="btn btn--accent" onClick={listen}>Listen now</button>}
        <button className={`follow-btn follow-btn--lg follow-btn--dark ${rel.followed ? 'is-on' : ''}`} onClick={() => follow(c.id)}>
          {rel.followed ? 'Following' : 'Follow'}
        </button>
        <button
          className="btn btn--ghost-dark"
          onClick={() => {
            recordConcert(c.id)
            pushToast({ tone: 'info', title: c.kind === 'artist' ? 'Show logged' : 'Live taping logged', detail: `Going to see ${c.name} counts more than any like. Demo check-in.` })
          }}
        >
          <Ticket size={16} /> {c.kind === 'artist' ? 'I went to a show' : 'I went to a live taping'}
        </button>
        <button className="link-btn link-btn--on-dark" onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: c.id })}>Full profile</button>
      </div>
      <RewardCard rel={rel} />
    </div>
  )
}
