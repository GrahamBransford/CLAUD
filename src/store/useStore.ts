import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultFollows } from '../data'
import type { SaveMethod, SavedItem, Signals } from '../types'
import type { StreamingProviderId } from '../lib/streaming'

const emptySignals = (): Signals => ({ minutes: 0, completions: 0, repeats: 0, plays: 0, concerts: 0, reactions: 0, views: 0 })

/** Durable, per-device state. Persisted to localStorage, per content set. */
interface PersistedState {
  initialized: boolean
  saved: SavedItem[]
  follows: string[]
  /** Engagement recorded inside CIRCA, per creator. */
  signals: Record<string, Signals>
  /** How many times each song/episode has been played (for repeat listening). */
  heard: Record<string, number>
  reacted: string[]
  viewed: string[]
  /** Where each creator sat on the record at the last visit to Your Record. */
  lastTop: Record<string, number>
  artistsIndex: number
  podcastsIndex: number
  circleIndex: number
  episodeProgress: Record<string, number>
  streaming: StreamingProviderId | null

  ensureDefaults: () => void
  save: (id: string, kind: SavedItem['kind'], via: SaveMethod) => boolean
  unsave: (id: string) => void
  isSaved: (id: string) => boolean
  toggleFollow: (creatorId: string) => boolean
  /** A play of an item: minutes heard, and whether it was heard through. */
  recordListen: (creatorId: string, itemId: string, seconds: number, completed: boolean) => void
  recordConcert: (creatorId: string) => void
  toggleReaction: (postId: string, creatorId: string) => boolean
  recordView: (postId: string, creatorId: string) => void
  setLastTop: (m: Record<string, number>) => void
  setArtistsIndex: (i: number) => void
  setPodcastsIndex: (i: number) => void
  setCircleIndex: (i: number) => void
  setEpisodeProgress: (id: string, t: number) => void
  setStreaming: (p: StreamingProviderId | null) => void
  resetDemo: () => void
}

const initial = () => ({
  initialized: false,
  saved: [] as SavedItem[],
  follows: [] as string[],
  signals: {} as Record<string, Signals>,
  heard: {} as Record<string, number>,
  reacted: [] as string[],
  viewed: [] as string[],
  lastTop: {} as Record<string, number>,
  artistsIndex: 0,
  podcastsIndex: 0,
  circleIndex: 0,
  episodeProgress: {} as Record<string, number>,
  streaming: null as StreamingProviderId | null,
})

const bump = (st: PersistedState, creatorId: string, patch: (s: Signals) => Partial<Signals>) => {
  const cur = st.signals[creatorId] ?? emptySignals()
  return { signals: { ...st.signals, [creatorId]: { ...cur, ...patch(cur) } } }
}

export const storageKey = (set: string) => `circa-state-${set}`

export const createStore = (set: string) =>
  create<PersistedState>()(
    persist(
      (setState, get) => ({
        ...initial(),

        ensureDefaults: () => {
          if (!get().initialized) setState({ initialized: true, follows: [...defaultFollows] })
        },

        save: (id, kind, via) => {
          if (get().saved.some((s) => s.id === id)) return false
          setState((st) => ({ saved: [{ id, kind, via, savedAt: Date.now() }, ...st.saved] }))
          return true
        },
        unsave: (id) => setState((st) => ({ saved: st.saved.filter((s) => s.id !== id) })),
        isSaved: (id) => get().saved.some((s) => s.id === id),

        toggleFollow: (creatorId) => {
          const following = get().follows.includes(creatorId)
          setState((st) => ({
            follows: following ? st.follows.filter((f) => f !== creatorId) : [...st.follows, creatorId],
          }))
          return !following
        },

        recordListen: (creatorId, itemId, seconds, completed) =>
          setState((st) => {
            const times = st.heard[itemId] ?? 0
            return {
              heard: { ...st.heard, [itemId]: times + 1 },
              ...bump(st, creatorId, (s) => ({
                plays: s.plays + 1,
                minutes: s.minutes + seconds / 60,
                completions: s.completions + (completed ? 1 : 0),
                repeats: s.repeats + (times > 0 && seconds > 20 ? 1 : 0),
              })),
            }
          }),

        recordConcert: (creatorId) => setState((st) => bump(st, creatorId, (s) => ({ concerts: s.concerts + 1 }))),

        toggleReaction: (postId, creatorId) => {
          const on = !get().reacted.includes(postId)
          setState((st) => ({
            reacted: on ? [...st.reacted, postId] : st.reacted.filter((p) => p !== postId),
            ...bump(st, creatorId, (s) => ({ reactions: Math.max(0, s.reactions + (on ? 1 : -1)) })),
          }))
          return on
        },

        recordView: (postId, creatorId) => {
          if (get().viewed.includes(postId)) return
          setState((st) => ({ viewed: [...st.viewed, postId], ...bump(st, creatorId, (s) => ({ views: s.views + 1 })) }))
        },

        setLastTop: (lastTop) => setState({ lastTop }),
        setArtistsIndex: (i) => setState({ artistsIndex: Math.max(0, i) }),
        setPodcastsIndex: (i) => setState({ podcastsIndex: Math.max(0, i) }),
        setCircleIndex: (i) => setState({ circleIndex: Math.max(0, i) }),
        setEpisodeProgress: (id, t) => setState((st) => ({ episodeProgress: { ...st.episodeProgress, [id]: t } })),
        setStreaming: (p) => setState({ streaming: p }),
        resetDemo: () => setState({ ...initial(), initialized: true, follows: [...defaultFollows] }),
      }),
      {
        name: storageKey(set),
        partialize: (s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { ensureDefaults, save, unsave, isSaved, toggleFollow, recordListen, recordConcert, toggleReaction, recordView, setLastTop, setArtistsIndex, setPodcastsIndex, setCircleIndex, setEpisodeProgress, setStreaming, resetDemo, ...data } = s
          return data
        },
      },
    ),
  )

/**
 * The store is created once the content set is known (each set keeps its own
 * saves and follows). main.tsx calls initStore() before rendering.
 */
export let useStore: ReturnType<typeof createStore>
export function initStore(set: string) {
  useStore = createStore(set)
  useStore.getState().ensureDefaults()
}
