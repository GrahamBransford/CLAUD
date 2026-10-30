import { creatorById, episodes, innerCircle, listeningSeed, songs } from '../data'
import type { SavedItem, Signals } from '../types'

/**
 * CIRCA's relationship model.
 *
 * Every creator relationship is scored in "engagement points" from meaningful
 * signals — time listened, full listens, coming back, saving, following,
 * going to shows — with light-touch reactions deliberately worth little.
 *
 * Points become a SIMULATED percentile by comparing them against a modelled
 * audience for that creator (a log-normal spread of fan engagement whose
 * median scales with the creator's size). This is an estimate for the
 * prototype, not a verified ranking: a real system would compare against
 * actual listener data from connected services.
 */

export const WEIGHTS = {
  minutes: 1,
  completions: 8,
  repeats: 5,
  saves: 12,
  follow: 20,
  concerts: 90,
  views: 3,
  reactions: 1,
} as const

export const SIGNAL_LABELS: Record<keyof typeof WEIGHTS, string> = {
  minutes: 'Minutes listened',
  completions: 'Full listens',
  repeats: 'Came back to',
  saves: 'Saved',
  follow: 'Following',
  concerts: 'Shows attended',
  views: 'Inner Circle moments watched',
  reactions: 'Reactions',
}

export type TierId = 'discovered' | 'regular' | 'devoted' | 'inner' | 'top1'

/** Tiers run from the edge of the record (discovered) to its centre (top 1%). */
export const TIERS: { id: TierId; label: string; maxTop: number; line: string }[] = [
  { id: 'top1', label: 'Top 1%', maxTop: 1, line: 'The centre of the record.' },
  { id: 'inner', label: 'Inner Circle', maxTop: 5, line: 'Among their most dedicated listeners.' },
  { id: 'devoted', label: 'Devoted', maxTop: 20, line: 'You keep coming back.' },
  { id: 'regular', label: 'Regular', maxTop: 50, line: 'Part of your rotation.' },
  { id: 'discovered', label: 'Discovered', maxTop: 100, line: 'Newly found, on the outer edge.' },
]

export const tierFor = (top: number) => TIERS.find((t) => top <= t.maxTop) ?? TIERS[TIERS.length - 1]
export const tierIndex = (id: TierId) => TIERS.length - 1 - TIERS.findIndex((t) => t.id === id) // 0 = discovered

export interface Relationship {
  creatorId: string
  followed: boolean
  signals: Signals & { saves: number }
  points: number
  /** Simulated "top X%" of this creator's listeners. */
  top: number
  tier: (typeof TIERS)[number]
  next?: { tier: (typeof TIERS)[number]; pointsNeeded: number; hint: string }
  /** 0 (centre) … 1 (outer edge) — radius on the record. */
  radius: number
}

const empty = (): Signals => ({ minutes: 0, completions: 0, repeats: 0, plays: 0, concerts: 0, reactions: 0, views: 0 })

// ---- modelled audience --------------------------------------------------

const SIGMA = 1.35
/** Median engagement points of a typical listener; bigger acts have keener crowds. */
const medianFor = (creatorId: string) => {
  const c = creatorById[creatorId]
  return c?.kind === 'podcast' ? 70 : 45
}

const erf = (x: number) => {
  // Abramowitz–Stegun 7.1.26
  const s = Math.sign(x)
  x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return s * y
}
const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2))
const normInv = (p: number) => {
  // Acklam's rational approximation
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924]
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857]
  const c = [-0.00778489400243029, -0.322396458041136, -2.40097599620718, -2.54973253934373, 4.37466414146497, 2.93816398269878]
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742]
  const pl = 0.02425
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** Simulated share of listeners with at least this many points, as a percentage. */
export function topPercent(creatorId: string, points: number) {
  if (points <= 0) return 100
  const z = (Math.log(points) - Math.log(medianFor(creatorId))) / SIGMA
  return Math.min(100, Math.max(0.1, 100 * (1 - normCdf(z))))
}

const pointsForTop = (creatorId: string, top: number) =>
  Math.exp(Math.log(medianFor(creatorId)) + SIGMA * normInv(1 - top / 100))

/**
 * Radius on the record: log-scaled so every tier band has room.
 * top 0.1% → 0 (label edge), 100% → 1 (outer groove).
 */
export const radiusForTop = (top: number) => Math.min(1, Math.max(0, Math.log10(Math.max(top, 0.1) / 0.1) / 3))

// ---- relationships ------------------------------------------------------

export function relationshipFor(
  creatorId: string,
  follows: string[],
  live: Record<string, Signals>,
  saved: SavedItem[],
): Relationship {
  const seed = listeningSeed[creatorId] ?? {}
  const l = live[creatorId] ?? empty()
  const savedHere = saved.filter((s) =>
    s.kind === 'song'
      ? songs.find((x) => x.id === s.id)?.creatorId === creatorId
      : episodes.find((x) => x.id === s.id)?.creatorId === creatorId,
  ).length
  const signals = {
    minutes: (seed.minutes ?? 0) + l.minutes,
    completions: (seed.completions ?? 0) + l.completions,
    repeats: (seed.repeats ?? 0) + l.repeats,
    plays: (seed.plays ?? 0) + l.plays,
    concerts: (seed.concerts ?? 0) + l.concerts,
    reactions: (seed.reactions ?? 0) + l.reactions,
    views: (seed.views ?? 0) + l.views,
    saves: ((seed as { saves?: number }).saves ?? 0) + savedHere,
  }
  const followed = follows.includes(creatorId)
  const points =
    signals.minutes * WEIGHTS.minutes +
    signals.completions * WEIGHTS.completions +
    signals.repeats * WEIGHTS.repeats +
    signals.saves * WEIGHTS.saves +
    (followed ? WEIGHTS.follow : 0) +
    signals.concerts * WEIGHTS.concerts +
    signals.views * WEIGHTS.views +
    signals.reactions * WEIGHTS.reactions
  const top = topPercent(creatorId, points)
  const tier = tierFor(top)
  const ti = TIERS.indexOf(tier)
  let next: Relationship['next']
  if (ti > 0) {
    const target = TIERS[ti - 1]
    const need = Math.max(1, Math.ceil(pointsForTop(creatorId, target.maxTop) - points))
    next = { tier: target, pointsNeeded: need, hint: hintFor(creatorId, need) }
  }
  return { creatorId, followed, signals, points: Math.round(points), top, tier, next, radius: radiusForTop(top) }
}

function hintFor(creatorId: string, need: number) {
  const noun = creatorById[creatorId]?.kind === 'podcast' ? 'full episodes' : 'full listens'
  const listens = Math.ceil(need / (WEIGHTS.completions + 3))
  if (need >= WEIGHTS.concerts * 0.8) return `about ${listens} more ${noun}, or one show`
  return `about ${listens} more ${noun === 'full listens' && listens === 1 ? 'full listen' : noun}`
}

/** Everyone in the listener's universe: followed, or with any listening at all. */
export function universe(follows: string[], live: Record<string, Signals>, saved: SavedItem[]) {
  const ids = new Set<string>([...follows, ...Object.keys(listeningSeed), ...Object.keys(live)])
  saved.forEach((s) => {
    const cid = songs.find((x) => x.id === s.id)?.creatorId ?? episodes.find((x) => x.id === s.id)?.creatorId
    if (cid) ids.add(cid)
  })
  return [...ids]
    .filter((id) => creatorById[id])
    .map((id) => relationshipFor(id, follows, live, saved))
    .filter((r) => r.points > 0 || r.followed)
    .sort((a, b) => a.top - b.top)
}

/** Inner Circle feed: followed creators only, closest relationships first. */
export function rankInnerCircle(follows: string[], live: Record<string, Signals>, saved: SavedItem[]) {
  const rel = new Map<string, Relationship>()
  const r = (id: string) => {
    if (!rel.has(id)) rel.set(id, relationshipFor(id, follows, live, saved))
    return rel.get(id)!
  }
  return innerCircle
    .filter((p) => follows.includes(p.creatorId))
    .map((post) => ({ post, rel: r(post.creatorId) }))
    .sort((a, b) => a.rel.top - b.rel.top || a.post.postedHoursAgo - b.post.postedHoursAgo)
}

export const formatTop = (top: number) =>
  top <= 1 ? `Top ${top < 0.5 ? '0.5' : '1'}%` : top < 10 ? `Top ${top.toFixed(1).replace(/\.0$/, '')}%` : `Top ${Math.round(top)}%`

/** "Devoted · Top 12%", or just "Top 1%" when the tier already says it. */
export const standing = (r: Relationship) => (r.tier.id === 'top1' ? formatTop(r.top) : `${r.tier.label} · ${formatTop(r.top)}`)

export const reasonFor = (r: Relationship) => {
  const c = creatorById[r.creatorId]
  const bits: string[] = []
  if (r.signals.plays) bits.push(`${r.signals.plays} ${r.signals.plays === 1 ? 'play' : 'plays'}`)
  if (r.signals.completions) bits.push(`${r.signals.completions} full ${c?.kind === 'podcast' ? 'episodes' : 'listens'}`)
  if (r.signals.concerts) bits.push(`${r.signals.concerts} ${r.signals.concerts === 1 ? 'show' : 'shows'}`)
  if (r.signals.saves) bits.push(`${r.signals.saves} saved`)
  return bits.length ? bits.join(' · ') : 'New to your record'
}
