import { creatorById, creatorVinylById } from '../data'
import type { Experience } from '../types'
import { alignment, type Taste } from './social'

/** Creators follow other creators only: the ones that sit closest on their own vinyl. */
export const followingOf = (creatorId: string) => {
  const v = creatorVinylById[creatorId]
  if (!v) return []
  return Object.entries(v.points)
    .filter(([id, pts]) => id !== creatorId && creatorById[id] && pts >= 250)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
}


export const fmtCount = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`
      : n >= 1e4
        ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`
        : n.toLocaleString()

/**
 * A creator's reach, TikTok-style: everyone who has listened to them on any
 * platform, and every stream across their whole career. Demo figures.
 */
export const reachOf = (creatorId: string) => {
  const c = creatorById[creatorId]
  return { listeners: c?.listeners ?? 0, streams: c?.lifetimeStreams ?? 0 }
}

/**
 * Whose taste is closest to yours, among creators: the same alignment used
 * between listeners (shared listening, plus shows you've both been to),
 * against what each creator listens to on their own vinyl.
 */
export function tasteTwins(mine: Taste, myLive: Experience[]) {
  return Object.values(creatorVinylById)
    .filter((v) => v.creatorId && creatorById[v.creatorId])
    .map((v) => ({ creatorId: v.creatorId!, ...alignment(mine, v.points, myLive, v.experiences) }))
    .sort((a, b) => b.score - a.score)
}
