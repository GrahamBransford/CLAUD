import { creatorById, creators, people } from '../data'
import type { Experience, FriendState, Person } from '../types'
import { tierFor, topPercent, type Relationship } from './affinity'

/**
 * Shared taste between two listeners, from the local data only.
 *
 * Both sides are vectors of engagement points per creator (the same scale
 * the record uses). Alignment is their cosine similarity on a log scale, so
 * one obsession doesn't drown out everything else, with a small lift for
 * having seen the same creator live. It is a demo estimate, nothing more.
 */

export type Taste = Record<string, number>

export const tasteOf = (rels: Relationship[]): Taste => Object.fromEntries(rels.map((r) => [r.creatorId, r.points]))

const LIVE_KINDS = new Set(['concert', 'festival', 'performance'])
export const liveCreators = (xs: Experience[]) => new Set(xs.filter((x) => x.creatorId && LIVE_KINDS.has(x.kind)).map((x) => x.creatorId!))

export interface Alignment {
  /** 0–100 */
  score: number
  /** Creators you both have on your vinyls, strongest shared bond first. */
  shared: string[]
  /** Creators you have both seen live. */
  sharedLive: string[]
}

export function alignment(mine: Taste, theirs: Taste, myLive: Experience[], theirLive: Experience[]): Alignment {
  const ids = new Set([...Object.keys(mine), ...Object.keys(theirs)])
  let dot = 0
  let a2 = 0
  let b2 = 0
  for (const id of ids) {
    const a = Math.log1p(mine[id] ?? 0)
    const b = Math.log1p(theirs[id] ?? 0)
    dot += a * b
    a2 += a * a
    b2 += b * b
  }
  const cos = a2 && b2 ? dot / Math.sqrt(a2 * b2) : 0
  const mineLive = liveCreators(myLive)
  const sharedLive = [...liveCreators(theirLive)].filter((id) => mineLive.has(id))
  const score = Math.round(Math.max(0, Math.min(99, 100 * (0.88 * cos + 0.12 * Math.min(1, sharedLive.length / 2)))))
  const shared = [...ids]
    .filter((id) => (mine[id] ?? 0) > 0 && (theirs[id] ?? 0) > 0)
    .sort((x, y) => Math.min(mine[y], theirs[y]) - Math.min(mine[x], theirs[x]))
  return { score, shared, sharedLive }
}

/** Someone else's record: their creators, placed with the same model as yours. */
export const vinylOf = (p: Person) =>
  Object.entries(p.points)
    .filter(([id, pts]) => creatorById[id] && pts > 0)
    .map(([creatorId, points]) => {
      const top = topPercent(creatorId, points)
      return { creatorId, points, top, tier: tierFor(top) }
    })
    .sort((a, b) => a.top - b.top)

export const mutualFriends = (p: Person, mine: Record<string, FriendState>) =>
  p.friends.filter((id) => mine[id] === 'friends')

/** The keenest sample listeners of one creator (demo data). */
export const topListeners = (creatorId: string) =>
  people
    .filter((p) => (p.points[creatorId] ?? 0) > 0)
    .map((p) => ({ person: p, top: topPercent(creatorId, p.points[creatorId]) }))
    .sort((a, b) => a.top - b.top)

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** The catalogue: creators and people, matched on what you'd type. */
export function search(q: string) {
  const t = norm(q.trim().replace(/^@/, ''))
  if (!t) return { creators: [], people: [] }
  const hit = (...fields: (string | undefined)[]) => fields.some((f) => f && norm(f).includes(t))
  return {
    creators: creators.filter((c) => hit(c.name, c.genre, c.location, ...(c.hosts ?? []))),
    people: people.filter((p) => hit(p.name, p.username, p.location)),
  }
}

/** "Saw Juniper Vale · Music Hall of Williamsburg · 2025" */
export const experienceLine = (x: Experience) =>
  [x.kind === 'festival' ? x.title : x.creatorId ? creatorById[x.creatorId]?.name ?? x.title : x.title, x.place, x.year].filter(Boolean).join(' · ')
