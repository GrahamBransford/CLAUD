import { creatorById } from '../data'
import { useStore } from '../store/useStore'

/**
 * Saving something you chose is the strongest "more of this" there is, so it
 * also follows the creator: on the platform the save went to (the listener's
 * streaming service for songs, YouTube for podcasts) and on CIRCA, wherever
 * they weren't followed already. Returns the line that says so, or null when
 * there was nothing new to follow. The platform side is simulated, like every
 * outside connection in the prototype.
 */
export function followOnSave(creatorId: string, platform: { id: string; name: string }) {
  const r = useStore.getState().followEverywhere(creatorId, platform.id)
  const where = [r.platform && platform.name, r.circa && 'CIRCA'].filter(Boolean)
  if (!where.length) return null
  return `Now following ${creatorById[creatorId]?.name ?? 'them'} on ${where.join(' and ')}`
}
