import { communities, creatorById, personById } from '../data'
import type { Community, Coords, FriendState } from '../types'
import { formatTop } from './affinity'
import { distanceLabel, km } from './geo'
import type { ListeningProfile } from './profile'

/**
 * Finding your people. In CIRCA's future an AI does this across everyone; in
 * the demo it's a transparent score over the same signals: how much you love
 * the creator, how much of your music is their style, how close the group
 * meets, and whether friends are already in it. Every match says why.
 */
export interface CommunityMatch {
  community: Community
  score: number
  km?: number
  near: boolean
  reasons: string[]
  friends: string[]
}

const NEAR_KM = 80

function styleShare(p: ListeningProfile, style: string | undefined) {
  if (!style) return 0
  const music = p.artists.reduce((n, a) => n + a.minutes, 0) || 1
  return p.artists.filter((a) => creatorById[a.creatorId]?.style === style).reduce((n, a) => n + a.minutes, 0) / music
}

export function matchCommunity(c: Community, p: ListeningProfile, here: Coords | undefined, friends: Record<string, FriendState>): CommunityMatch {
  const creator = creatorById[c.creatorId]
  const st = [...p.artists, ...p.podcasts].find((s) => s.creatorId === c.creatorId)
  const taste = st ? Math.min(1, st.points / 600) : 0
  const share = styleShare(p, c.styles[0])
  const d = here && c.coords ? km(here, c.coords) : undefined
  const inPerson = c.format !== 'Online'
  const near = inPerson && d !== undefined && d < NEAR_KM
  const local = c.format === 'Online' ? 0.45 : d === undefined ? 0 : Math.exp(-d / 60)
  const pals = c.memberIds.filter((id) => friends[id] === 'friends')
  const score = 0.45 * taste + 0.25 * share + 0.2 * local + 0.1 * Math.min(1, pals.length)

  const reasons: string[] = []
  if (st && st.top <= 20) reasons.push(`You’re ${formatTop(st.top).replace('Top', 'in the top')} of ${creator?.name}’s listeners`)
  else if (st) reasons.push(`${creator?.name} is on your vinyl`)
  if (share >= 0.15 && c.styles[0]) reasons.push(`${c.styles[0]} is ${Math.round(share * 100)}% of your music`)
  if (near && d !== undefined) reasons.push(d < 5 ? 'Meets in your neighbourhood' : `Meets ${distanceLabel(d)} from you`)
  else if (c.format === 'Online') reasons.push('Online, so it’s always nearby')
  if (pals.length) reasons.push(`${pals.map((id) => personById[id]?.name.split(' ')[0]).join(' and ')} ${pals.length === 1 ? 'is a member' : 'are members'}`)
  return { community: c, score, km: d, near, reasons, friends: pals }
}

export function matchAll(p: ListeningProfile, here: Coords | undefined, friends: Record<string, FriendState>) {
  return communities.map((c) => matchCommunity(c, p, here, friends)).sort((a, b) => b.score - a.score)
}

export const communitiesOf = (creatorId: string) => communities.filter((c) => c.creatorId === creatorId)

export const whenLabel = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return days === 0 ? 'Tonight' : days === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
