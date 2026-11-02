import { creatorById, creatorVinylById, episodes, personById, songs } from '../data'
import type { Experience, Person } from '../types'
import { TIERS, tierFor, topPercent, type Relationship } from './affinity'

/**
 * Everything a vinyl knows about its owner's listening, in one shape, for
 * any account: you, a friend, a sample listener, or a creator's own vinyl.
 *
 * Yours comes from your relationships (simulated history plus what you do in
 * CIRCA). Everyone else's is derived from their engagement points. Periods,
 * "following since", time-of-day preferences and recent activity are
 * estimates for the prototype, and the UI says so.
 */

/** How many faces a record carries: the closest, so it never gets crowded. */
export const ON_RECORD = 12

export type Owner = 'me' | string // 'me', a person id, or 'creator:<id>'

export interface CreatorStats {
  creatorId: string
  kind: 'artist' | 'podcast'
  minutes: number
  /** Full listens (songs) or full episodes. */
  completions: number
  plays: number
  shows: number
  points: number
  top: number
  tier: (typeof TIERS)[number]
  followed: boolean
  /** "Mar 2024" */
  followedSince?: string
  mostPlayed?: { title: string; plays: number }
  recent: string[]
}

export interface Periods {
  week: number
  month: number
  year: number
  all: number
}

export interface GenreStat {
  genre: string
  minutes: number
  share: number
  creators: number
  /** How they listen to it: "On repeat · Late at night". */
  how: string
}

export interface ListeningProfile {
  owner: Owner
  /** "You", or the owner's first name. */
  who: string
  minutes: Periods
  /** The last eight weeks, oldest first. */
  weekly: number[]
  musicShare: number
  completionRate: number
  peak: string
  artists: CreatorStats[]
  podcasts: CreatorStats[]
  genres: GenreStat[]
  /** Set when one style carries a big share of their music: its top three. */
  style?: { name: string; share: number; artists: CreatorStats[] }
  experiences: Experience[]
}

/** A stable pseudo-random number in [0, 1) from a string. */
export const hash01 = (s: string) => {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ((h >>> 0) % 10007) / 10007
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthsAgo = (n: number) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const LIVE = new Set(['concert', 'festival', 'performance'])
const showsWith = (xs: Experience[], creatorId: string) => xs.filter((x) => x.creatorId === creatorId && LIVE.has(x.kind))

/** The most played song or episode title for a creator. */
function topWork(creatorId: string, plays: number, seed: string) {
  const c = creatorById[creatorId]
  const titles = [
    ...songs.filter((s) => s.creatorId === creatorId).map((s) => s.title),
    ...episodes.filter((e) => e.creatorId === creatorId).map((e) => e.title),
    ...(c?.works ?? []),
  ]
  if (!titles.length || plays <= 0) return undefined
  return { title: titles[Math.floor(hash01(seed) * Math.min(2, titles.length))], plays: Math.max(1, Math.round(plays * (0.45 + 0.3 * hash01(seed + 'p')))) }
}

function recentFor(who: string, st: Omit<CreatorStats, 'recent'>, xs: Experience[], extra: string[] = []) {
  const c = creatorById[st.creatorId]
  const out: string[] = []
  const me = who === 'You'
  const h = hash01(who + st.creatorId)
  if (st.mostPlayed && st.plays > 2)
    out.push(`${me ? 'Played' : 'Played'} “${st.mostPlayed.title}” ${Math.max(1, Math.round(st.mostPlayed.plays * 0.2))}× this week`)
  const last = showsWith(xs, st.creatorId).sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0]
  if (last) out.push(`Saw ${c?.kind === 'podcast' ? 'a live taping' : 'them live'}${last.place ? ` at ${last.place}` : ''}${last.year ? `, ${last.year}` : ''}`)
  if (st.followed && h > 0.45) out.push(c?.kind === 'podcast' ? 'Finished a new episode the day it came out' : 'Watched an Inner Circle moment')
  if (st.tier.id === 'top1' || st.tier.id === 'inner') out.push(`Moved into ${st.tier.label}`)
  for (const line of extra) if (c && line.includes(c.name)) out.push(line)
  return [...new Set(out)].slice(0, 3)
}

function periods(all: number, seed: string): Periods {
  const year = Math.round(all * (0.48 + 0.12 * hash01(seed + 'y')))
  const month = Math.round(year * (0.14 + 0.06 * hash01(seed + 'm')))
  const week = Math.round(month * (0.24 + 0.08 * hash01(seed + 'w')))
  return { week, month, year, all: Math.round(all) }
}

const PEAKS = ['Late at night', 'Early mornings', 'On the commute', 'Weekend afternoons', 'While working']

function assemble(owner: Owner, who: string, stats: CreatorStats[], experiences: Experience[], liveWeek = 0): ListeningProfile {
  const artists = stats.filter((s) => s.kind === 'artist').sort((a, b) => b.points - a.points)
  const podcasts = stats.filter((s) => s.kind === 'podcast').sort((a, b) => b.points - a.points)
  const sum = (xs: CreatorStats[], k: 'minutes' | 'plays' | 'completions') => xs.reduce((n, s) => n + s[k], 0)
  const all = sum(stats, 'minutes')
  const music = sum(artists, 'minutes')
  const p = periods(all, owner)
  p.week += Math.round(liveWeek)
  const weekly = Array.from({ length: 8 }, (_, i) => (i === 7 ? p.week : Math.round(p.week * (0.55 + 0.9 * hash01(`${owner}w${i}`)))))

  // genres: music only, by minutes, with how they're listened to
  const byGenre = new Map<string, CreatorStats[]>()
  for (const a of artists) {
    const g = creatorById[a.creatorId]?.genre ?? 'Other'
    byGenre.set(g, [...(byGenre.get(g) ?? []), a])
  }
  const genres = [...byGenre.entries()]
    .map(([genre, xs]) => {
      const minutes = sum(xs, 'minutes')
      const plays = Math.max(1, sum(xs, 'plays'))
      const done = sum(xs, 'completions') / plays
      const habit = done > 0.85 ? 'All the way through' : done > 0.6 ? 'Mostly full listens' : 'Dips in and out'
      return { genre, minutes, share: music ? minutes / music : 0, creators: xs.length, how: `${habit} · ${PEAKS[Math.floor(hash01(owner + genre) * PEAKS.length)]}` }
    })
    .sort((a, b) => b.minutes - a.minutes)

  // a style they clearly love: its top three
  const byStyle = new Map<string, CreatorStats[]>()
  for (const a of artists) {
    const st = creatorById[a.creatorId]?.style
    if (st) byStyle.set(st, [...(byStyle.get(st) ?? []), a])
  }
  const lead = [...byStyle.entries()].map(([name, xs]) => ({ name, xs, share: music ? sum(xs, 'minutes') / music : 0 })).sort((a, b) => b.share - a.share)[0]
  const style = lead && lead.xs.length >= 3 && lead.share >= 0.3 ? { name: lead.name, share: lead.share, artists: lead.xs.slice(0, 3) } : undefined

  const plays = Math.max(1, sum(stats, 'plays'))
  return {
    owner,
    who,
    minutes: p,
    weekly,
    musicShare: all ? music / all : 0,
    completionRate: sum(stats, 'completions') / plays,
    peak: PEAKS[Math.floor(hash01(owner + 'peak') * PEAKS.length)],
    artists,
    podcasts,
    genres,
    style,
    experiences,
  }
}

/** Your profile, from your relationships with every creator in your universe. */
export function profileForMe(rels: Relationship[], experiences: Experience[], liveSignals: Record<string, { minutes: number }>): ListeningProfile {
  const stats = rels
    .filter((r) => creatorById[r.creatorId])
    .map((r) => {
      const c = creatorById[r.creatorId]
      const shows = Math.max(r.signals.concerts, showsWith(experiences, r.creatorId).length)
      const base = {
        creatorId: r.creatorId,
        kind: c.kind,
        minutes: Math.round(r.signals.minutes),
        completions: r.signals.completions,
        plays: r.signals.plays,
        shows,
        points: r.points,
        top: r.top,
        tier: r.tier,
        followed: r.followed,
        followedSince: r.followed ? monthsAgo(2 + Math.min(46, Math.round(r.points / 45 + hash01(r.creatorId) * 6))) : undefined,
        mostPlayed: topWork(r.creatorId, r.signals.plays, 'me' + r.creatorId),
      }
      return { ...base, recent: recentFor('You', base, experiences) }
    })
  const liveWeek = Object.values(liveSignals).reduce((n, s) => n + (s.minutes ?? 0), 0)
  return assemble('me', 'You', stats, experiences, liveWeek)
}

/** Anyone else's profile (a listener, or a creator's own vinyl), from their points. */
export function profileForPerson(owner: Owner, p: Person): ListeningProfile {
  const first = p.name.split(' ')[0]
  const stats = Object.entries(p.points)
    .filter(([id, pts]) => creatorById[id] && pts > 0)
    .map(([creatorId, points]) => {
      const c = creatorById[creatorId]
      const h = hash01(p.id + creatorId)
      const completions = Math.max(1, Math.round((points / (c.kind === 'podcast' ? 30 : 14)) * (0.7 + 0.5 * h)))
      const plays = completions + Math.round(completions * (0.1 + 0.4 * h)) + 1
      const minutes = Math.round(points * (c.kind === 'podcast' ? 0.9 : 0.42) * (0.8 + 0.4 * h))
      const top = topPercent(creatorId, points)
      const base = {
        creatorId,
        kind: c.kind,
        minutes,
        completions,
        plays,
        shows: showsWith(p.experiences, creatorId).length,
        points,
        top,
        tier: tierFor(top),
        followed: points > 120,
        followedSince: points > 120 ? monthsAgo(3 + Math.min(52, Math.round(points / 40 + h * 8))) : undefined,
        mostPlayed: topWork(creatorId, plays, p.id + creatorId),
      }
      return { ...base, recent: recentFor(first, base, p.experiences, p.recent) }
    })
  return assemble(owner, first, stats, p.experiences)
}

/** Resolve an owner id to the person whose vinyl it is (undefined for 'me'). */
export const personFor = (owner: Owner): Person | undefined =>
  owner === 'me' ? undefined : owner.startsWith('creator:') ? creatorVinylById[owner.slice(8)] : personById[owner]

export const fmtMinutes = (m: number) => (m >= 10000 ? `${(m / 1000).toFixed(m >= 100000 ? 0 : 1)}k` : m.toLocaleString())
export const fmtHours = (m: number) => (m < 60 ? `${m} min` : `${Math.round(m / 60).toLocaleString()} h`)
