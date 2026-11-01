import { creatorById, personById } from '../data'
import { hash01, profileForPerson } from './profile'

/**
 * Friends' vinyl updates, gathered in one place so nobody has to open every
 * friend's record to see what changed. Built from each sample listener's
 * recent activity and their records (simulated, like everything about them).
 */
export interface Update {
  key: string
  personId: string
  text: string
  creatorId?: string
  hoursAgo: number
}

export function friendUpdates(ids: string[]): Update[] {
  const out: Update[] = []
  for (const id of ids) {
    const p = personById[id]
    if (!p) continue
    const first = p.name.split(' ')[0]
    const prof = profileForPerson(id, p)
    const lines: { text: string; creatorId?: string }[] = (p.recent ?? []).map((text) => ({
      text,
      creatorId: Object.values(creatorById).find((c) => text.includes(c.name))?.id,
    }))
    const top = prof.artists[0]
    if (top) lines.push({ text: `Has ${creatorById[top.creatorId].name} at the centre of their vinyl`, creatorId: top.creatorId })
    const fresh = [...prof.artists, ...prof.podcasts].find((s) => s.tier.id === 'discovered')
    if (fresh) lines.push({ text: `Added ${creatorById[fresh.creatorId].name} to their vinyl`, creatorId: fresh.creatorId })
    const show = [...p.experiences].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0]
    if (show?.creatorId) lines.push({ text: `Etched ${creatorById[show.creatorId]?.name}${show.place ? ` at ${show.place}` : ''} into their run-out`, creatorId: show.creatorId })
    lines.forEach((l, i) =>
      out.push({ key: `${id}:${l.text}`, personId: id, text: `${first} · ${l.text}`.replace(`${first} · ${first} `, `${first} `), creatorId: l.creatorId, hoursAgo: Math.round(1 + hash01(id + i) * 70 + i * 9) }),
    )
  }
  const seen = new Set<string>()
  return out.filter((u) => !seen.has(u.text) && seen.add(u.text)).sort((a, b) => a.hoursAgo - b.hoursAgo)
}

export const ago = (h: number) => (h < 1 ? 'now' : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`)
