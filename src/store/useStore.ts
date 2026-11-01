import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultFollows, meSeed } from '../data'
import type { Experience, FriendState, Profile, SaveMethod, SavedItem, Signals } from '../types'
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
  /** Position in the Radio's mixed running order. */
  radioIndex: number
  circleIndex: number
  episodeProgress: Record<string, number>
  streaming: StreamingProviderId | null
  /** Your identity on CIRCA. Everything here is optional and self-reported. */
  profile: Profile
  experiences: Experience[]
  favorites: string[]
  friends: Record<string, FriendState>
  /** Friends whose vinyl updates you follow. */
  vinylFollows: string[]
  /** Who can open your vinyl (a demo preference: there is no server to enforce it). */
  vinylVisibility: 'everyone' | 'friends'
  /** Comments you wrote on Inner Circle moments. Kept on this device only. */
  myComments: Record<string, { id: string; text: string; at: number }[]>

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
  setRadioIndex: (i: number) => void
  setCircleIndex: (i: number) => void
  setEpisodeProgress: (id: string, t: number) => void
  setStreaming: (p: StreamingProviderId | null) => void
  setProfile: (patch: Partial<Profile>) => void
  /** Live experiences with a creator also count toward closeness, like a show. */
  addExperience: (x: Omit<Experience, 'id'>) => void
  removeExperience: (id: string) => void
  toggleFavorite: (creatorId: string) => boolean
  setFriend: (personId: string, state: FriendState | null) => void
  toggleVinylFollow: (personId: string) => boolean
  setVinylVisibility: (v: 'everyone' | 'friends') => void
  addComment: (postId: string, text: string) => void
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
  radioIndex: 0,
  circleIndex: 0,
  episodeProgress: {} as Record<string, number>,
  streaming: 'spotify' as StreamingProviderId | null,
  profile: {
    name: meSeed.name,
    username: meSeed.username,
    bio: meSeed.bio,
    location: meSeed.location,
    avatar: meSeed.avatar,
    socials: { ...meSeed.socials },
  } as Profile,
  experiences: [...meSeed.experiences],
  favorites: [...meSeed.favorites],
  friends: { ...meSeed.friends },
  vinylFollows: Object.keys(meSeed.friends).filter((id) => meSeed.friends[id] === 'friends'),
  vinylVisibility: 'everyone' as 'everyone' | 'friends',
  myComments: {} as Record<string, { id: string; text: string; at: number }[]>,
})

const LIVE = (x: Pick<Experience, 'kind' | 'creatorId'>) => !!x.creatorId && x.kind !== 'other'

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
        setRadioIndex: (i) => setState({ radioIndex: Math.max(0, i) }),
        setCircleIndex: (i) => setState({ circleIndex: Math.max(0, i) }),
        setEpisodeProgress: (id, t) => setState((st) => ({ episodeProgress: { ...st.episodeProgress, [id]: t } })),
        setStreaming: (p) => setState({ streaming: p }),
        setProfile: (patch) => setState((st) => ({ profile: { ...st.profile, ...patch } })),
        addExperience: (x) =>
          setState((st) => ({
            experiences: [{ ...x, id: `x-${Date.now().toString(36)}` }, ...st.experiences],
            ...(LIVE(x) ? bump(st, x.creatorId!, (s) => ({ concerts: s.concerts + 1 })) : {}),
          })),
        removeExperience: (id) =>
          setState((st) => {
            const x = st.experiences.find((e) => e.id === id)
            return {
              experiences: st.experiences.filter((e) => e.id !== id),
              ...(x && LIVE(x) ? bump(st, x.creatorId!, (s) => ({ concerts: Math.max(0, s.concerts - 1) })) : {}),
            }
          }),
        toggleFavorite: (creatorId) => {
          const on = !get().favorites.includes(creatorId)
          setState((st) => ({ favorites: on ? [...st.favorites, creatorId] : st.favorites.filter((f) => f !== creatorId) }))
          return on
        },
        setFriend: (personId, state) =>
          setState((st) => {
            const friends = { ...st.friends }
            if (state) friends[personId] = state
            else delete friends[personId]
            return {
              friends,
              vinylFollows:
                state === 'friends'
                  ? [...new Set([...st.vinylFollows, personId])]
                  : state ? st.vinylFollows : st.vinylFollows.filter((f) => f !== personId),
            }
          }),
        setVinylVisibility: (vinylVisibility) => setState({ vinylVisibility }),
        addComment: (postId, text) =>
          setState((st) => ({
            myComments: { ...st.myComments, [postId]: [...(st.myComments[postId] ?? []), { id: `c-${Date.now().toString(36)}`, text, at: Date.now() }] },
          })),
        toggleVinylFollow: (personId) => {
          const on = !get().vinylFollows.includes(personId)
          setState((st) => ({ vinylFollows: on ? [...st.vinylFollows, personId] : st.vinylFollows.filter((f) => f !== personId) }))
          return on
        },
        resetDemo: () => setState({ ...initial(), initialized: true, follows: [...defaultFollows] }),
      }),
      {
        name: storageKey(set),
        partialize: (s) => {
          // keep data, drop actions
          return Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as Partial<PersistedState>
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
