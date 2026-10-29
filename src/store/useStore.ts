import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultFollows } from '../data'
import type { CreatorListening, SaveMethod, SavedItem } from '../types'
import type { StreamingProviderId } from '../lib/streaming'

/** Durable, per-device state. Persisted to localStorage. */
interface PersistedState {
  saved: SavedItem[]
  follows: string[]
  listening: Record<string, CreatorListening>
  singersIndex: number
  speakersIndex: number
  episodeProgress: Record<string, number>
  streaming: StreamingProviderId | null

  save: (id: string, kind: SavedItem['kind'], via: SaveMethod) => boolean
  unsave: (id: string) => void
  isSaved: (id: string) => boolean
  toggleFollow: (creatorId: string) => boolean
  recordListen: (creatorId: string, completion: number, seconds: number) => void
  setSingersIndex: (i: number) => void
  setSpeakersIndex: (i: number) => void
  setEpisodeProgress: (id: string, t: number) => void
  setStreaming: (p: StreamingProviderId | null) => void
  resetDemo: () => void
}

const empty = (): CreatorListening => ({ plays: 0, completionSum: 0, completionCount: 0, saves: 0, seconds: 0 })

const initial = () => ({
  saved: [] as SavedItem[],
  follows: [...defaultFollows],
  listening: {} as Record<string, CreatorListening>,
  singersIndex: 0,
  speakersIndex: 0,
  episodeProgress: {} as Record<string, number>,
  streaming: null as StreamingProviderId | null,
})

export const useStore = create<PersistedState>()(
  persist(
    (set, get) => ({
      ...initial(),

      save: (id, kind, via) => {
        if (get().saved.some((s) => s.id === id)) return false
        set((st) => ({ saved: [{ id, kind, via, savedAt: Date.now() }, ...st.saved] }))
        return true
      },
      unsave: (id) => set((st) => ({ saved: st.saved.filter((s) => s.id !== id) })),
      isSaved: (id) => get().saved.some((s) => s.id === id),

      toggleFollow: (creatorId) => {
        const following = get().follows.includes(creatorId)
        set((st) => ({
          follows: following ? st.follows.filter((f) => f !== creatorId) : [...st.follows, creatorId],
        }))
        return !following
      },

      recordListen: (creatorId, completion, seconds) =>
        set((st) => {
          const cur = st.listening[creatorId] ?? empty()
          return {
            listening: {
              ...st.listening,
              [creatorId]: {
                ...cur,
                plays: cur.plays + 1,
                completionSum: cur.completionSum + Math.max(0, Math.min(1, completion)),
                completionCount: cur.completionCount + 1,
                seconds: cur.seconds + seconds,
              },
            },
          }
        }),

      setSingersIndex: (i) => set({ singersIndex: Math.max(0, i) }),
      setSpeakersIndex: (i) => set({ speakersIndex: Math.max(0, i) }),
      setEpisodeProgress: (id, t) => set((st) => ({ episodeProgress: { ...st.episodeProgress, [id]: t } })),
      setStreaming: (p) => set({ streaming: p }),
      resetDemo: () => set(initial()),
    }),
    {
      name: 'circa-prototype-v1',
      partialize: (s) => ({
        saved: s.saved,
        follows: s.follows,
        listening: s.listening,
        singersIndex: s.singersIndex,
        speakersIndex: s.speakersIndex,
        episodeProgress: s.episodeProgress,
        streaming: s.streaming,
      }),
    },
  ),
)
