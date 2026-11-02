import { useMemo } from 'react'
import { creatorById, personById } from '../data'
import { alignment, liveCreators, tasteOf, vinylOf } from '../lib/social'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Person } from '../types'
import type { Marker } from '../components/Turntable'
import { ON_RECORD } from '../lib/profile'
import { useUniverse } from './useRelationship'

/** Your taste as a vector of points per creator. */
export function useMyTaste() {
  const all = useUniverse()
  const omit = useStore((s) => s.omitStats)
  // taste matches are stats too: anyone left out of yours isn't matched on
  return useMemo(() => tasteOf(omit?.length ? all.filter((r) => !omit.includes(r.creatorId)) : all), [all, omit])
}

/** How aligned you are with someone, and what you share. */
export function useAlignment(p: Person | undefined) {
  const mine = useMyTaste()
  const experiences = useStore((s) => s.experiences)
  return useMemo(() => (p ? alignment(mine, p.points, experiences, p.experiences) : null), [p, mine, experiences])
}

/** Someone else's vinyl as markers, with what you share lit. */
export function usePersonMarkers(p: Person | undefined): Marker[] {
  const mine = useMyTaste()
  return useMemo(() => {
    if (!p) return []
    const live = liveCreators(p.experiences)
    return vinylOf(p).slice(0, ON_RECORD).map((r) => {
      const c = creatorById[r.creatorId]
      return { id: r.creatorId, name: c.name, avatar: c.avatar, top: r.top, tier: r.tier.id, live: live.has(r.creatorId), shared: (mine[r.creatorId] ?? 0) > 0, favorite: !!p.favorites?.includes(r.creatorId) }
    })
  }, [p, mine])
}

/**
 * Friendship, demo edition: requests you send are accepted by the sample
 * listener a moment later, and the toast says it's simulated.
 */
export function useFriendActions() {
  const setFriend = useStore((s) => s.setFriend)
  const toast = useUI((s) => s.pushToast)
  return useMemo(
    () => ({
      request(id: string) {
        const p = personById[id]
        setFriend(id, 'outgoing')
        toast({ image: p?.avatar, title: 'Request sent', detail: `to ${p?.name}` })
        window.setTimeout(() => {
          if (useStore.getState().friends[id] !== 'outgoing') return
          setFriend(id, 'friends')
          toast({ image: p?.avatar, title: `${p?.name} accepted`, detail: 'Simulated response · demo listener' })
        }, 3200)
      },
      accept(id: string) {
        setFriend(id, 'friends')
        toast({ image: personById[id]?.avatar, title: `You and ${personById[id]?.name} are friends` })
      },
      decline: (id: string) => setFriend(id, null),
      cancel: (id: string) => setFriend(id, null),
      remove(id: string) {
        setFriend(id, null)
        toast({ image: personById[id]?.avatar, title: `Removed ${personById[id]?.name}` })
      },
    }),
    [setFriend, toast],
  )
}
