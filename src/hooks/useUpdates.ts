import { useMemo } from 'react'
import { friendUpdates } from '../lib/updates'
import { useStore } from '../store/useStore'

/** Updates from friends whose vinyl you follow, and how many you haven't seen. */
export function useUpdates() {
  const friends = useStore((s) => s.friends)
  const follows = useStore((s) => s.vinylFollows)
  const seen = useStore((s) => s.seenUpdates)
  return useMemo(() => {
    const list = friendUpdates(follows.filter((id) => friends[id] === 'friends'))
    const seenSet = new Set(seen)
    const incoming = Object.values(friends).filter((f) => f === 'incoming').length
    return { list, unseen: list.filter((u) => !seenSet.has(u.key)).length, incoming, seen: seenSet }
  }, [friends, follows, seen])
}
