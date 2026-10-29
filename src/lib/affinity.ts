import { creatorById, episodes, listeningSeed, posts, songs } from '../data'
import type { CreatorListening, HandheldPost, SavedItem } from '../types'

/**
 * Creator affinity: how much a listener actually consumes and enjoys a
 * creator's work. In the prototype it blends a simulated streaming history
 * (standing in for Spotify / Apple Music data) with listening recorded in
 * the app. A real integration only has to replace `listeningSeed`.
 */
export interface Affinity {
  creatorId: string
  followed: boolean
  score: number // 0–100
  plays: number
  completion: number // 0–1
  saves: number
  reason: string
}

const PLAYS_FOR_MAX = 40
const SAVES_FOR_MAX = 4
export const WEIGHTS = { plays: 0.5, completion: 0.3, saves: 0.2 }

export function affinityFor(
  creatorId: string,
  follows: string[],
  listening: Record<string, CreatorListening>,
  saved: SavedItem[],
): Affinity {
  const seed = listeningSeed[creatorId] ?? { plays: 0, completion: 0, saves: 0 }
  const live = listening[creatorId]
  const plays = seed.plays + (live?.plays ?? 0)
  const completionWeight = seed.plays + (live?.completionCount ?? 0)
  const completion = completionWeight
    ? (seed.completion * seed.plays + (live?.completionSum ?? 0)) / completionWeight
    : 0
  const savedHere = saved.filter((s) =>
    s.kind === 'song'
      ? songs.find((x) => x.id === s.id)?.creatorId === creatorId
      : episodes.find((x) => x.id === s.id)?.creatorId === creatorId,
  ).length
  const saves = seed.saves + savedHere

  const playScore = Math.min(1, Math.log1p(plays) / Math.log1p(PLAYS_FOR_MAX))
  const saveScore = Math.min(1, saves / SAVES_FOR_MAX)
  const score = Math.round(
    100 * (WEIGHTS.plays * playScore + WEIGHTS.completion * completion + WEIGHTS.saves * saveScore),
  )
  const followed = follows.includes(creatorId)
  return { creatorId, followed, score, plays, completion, saves, reason: reasonFor(creatorId, plays, completion, saves) }
}

function reasonFor(creatorId: string, plays: number, completion: number, saves: number) {
  const c = creatorById[creatorId]
  const noun = c.kind === 'podcast' ? 'episodes' : 'songs'
  if (plays === 0) return `New to your circle. Listen to ${c.name} to bring them closer.`
  const times = plays === 1 ? 'once' : `${plays} times`
  const finish = completion > 0 ? ` and finish ${Math.round(completion * 100)}% of the ${noun} you start` : ''
  const kept = saves > 0 ? `. ${saves} saved` : ''
  return `You've listened to ${c.name} ${times}${finish}${kept}.`
}

/**
 * Handhelds ranking. Condition one: only creators you follow.
 * Condition two: order by how much of their work you actually consume,
 * then by recency within a creator.
 */
export function rankHandhelds(
  follows: string[],
  listening: Record<string, CreatorListening>,
  saved: SavedItem[],
): { post: HandheldPost; affinity: Affinity }[] {
  const cache = new Map<string, Affinity>()
  const aff = (id: string) => {
    if (!cache.has(id)) cache.set(id, affinityFor(id, follows, listening, saved))
    return cache.get(id)!
  }
  return posts
    .filter((p) => follows.includes(p.creatorId))
    .map((post) => ({ post, affinity: aff(post.creatorId) }))
    .sort((a, b) => b.affinity.score - a.affinity.score || a.post.postedHoursAgo - b.post.postedHoursAgo)
}

export function rankCircle(follows: string[], listening: Record<string, CreatorListening>, saved: SavedItem[]) {
  return follows
    .filter((id) => creatorById[id])
    .map((id) => affinityFor(id, follows, listening, saved))
    .sort((a, b) => b.score - a.score)
}
