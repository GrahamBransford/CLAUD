import { useCallback, useMemo, useState } from 'react'
import { relationshipFor, universe } from '../lib/affinity'
import { useStore } from '../store/useStore'

/** Live relationship with one creator; re-computes as signals change. */
export function useRelationship(creatorId: string | undefined) {
  const follows = useStore((s) => s.follows)
  const signals = useStore((s) => s.signals)
  const saved = useStore((s) => s.saved)
  return useMemo(
    () => (creatorId ? relationshipFor(creatorId, follows, signals, saved) : null),
    [creatorId, follows, signals, saved],
  )
}

/** Every creator in the listener's universe, closest first. */
export function useUniverse() {
  const follows = useStore((s) => s.follows)
  const signals = useStore((s) => s.signals)
  const saved = useStore((s) => s.saved)
  return useMemo(() => universe(follows, signals, saved), [follows, signals, saved])
}

/** An error message that belongs to one item and disappears when the item changes. */
export function useItemError(itemId: string | undefined) {
  const [err, setErr] = useState<{ id: string | undefined; msg: string } | null>(null)
  const error = err && err.id === itemId ? err.msg : null
  const setError = useCallback((msg: string) => setErr({ id: itemId, msg }), [itemId])
  return [error, setError] as const
}
