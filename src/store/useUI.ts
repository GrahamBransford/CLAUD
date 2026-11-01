import { create } from 'zustand'

export interface Toast {
  id: number
  title: string
  detail?: string
  image?: string
  action?: { label: string; run: () => void }
}

export type DetailTab = 'listening' | 'artists' | 'podcasts' | 'genres' | 'live'

export type Sheet =
  /** owner: whose vinyl it was opened from ('me' when omitted). */
  | { kind: 'creator'; creatorId: string; owner?: string }
  | { kind: 'details'; owner: string; tab: DetailTab }
  /** Communities: all matched for you, or one creator's (and local scenes in their style). */
  | { kind: 'communities'; creatorId?: string }
  | { kind: 'taste' }
  | { kind: 'settings' }
  | { kind: 'profile' }
  | { kind: 'live' }
  | { kind: 'friends' }
  | { kind: 'comments'; postId: string }
  | null

export interface FullEpisodeRequest {
  episodeId: string
  startAt: number
  reason: 'auto' | 'manual'
}

/** Ephemeral UI state; never persisted. */
interface UIState {
  toasts: Toast[]
  sheet: Sheet
  fullEpisode: FullEpisodeRequest | null
  drive: boolean
  /** Someone else's vinyl, open full-screen. */
  person: string | null
  /**
   * Video starts muted (browsers allow that without a gesture); the first
   * touch anywhere turns sound on, like Instagram.
   */
  audioUnlocked: boolean
  unlockedAt: number
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  openSheet: (s: Sheet) => void
  openFullEpisode: (r: FullEpisodeRequest | null) => void
  setDrive: (on: boolean) => void
  openPerson: (id: string | null) => void
  unlockAudio: () => void
}

let nextId = 1

export const useUI = create<UIState>()((set, get) => ({
  toasts: [],
  sheet: null,
  fullEpisode: null,
  drive: false,
  person: null,
  audioUnlocked: false,
  unlockedAt: 0,
  pushToast: (t) => {
    const id = nextId++
    set((st) => ({ toasts: [...st.toasts.slice(-1), { ...t, id }] }))
    window.setTimeout(() => get().dismissToast(id), 2800)
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  openSheet: (sheet) => set({ sheet }),
  openFullEpisode: (fullEpisode) => set({ fullEpisode }),
  setDrive: (drive) => set({ drive }),
  openPerson: (person) => set({ person, sheet: null }),
  unlockAudio: () => {
    if (!get().audioUnlocked) set({ audioUnlocked: true, unlockedAt: Date.now() })
  },
}))

/** True for a tap that only served to turn the sound on. */
export const tapWasUnlock = () => Date.now() - useUI.getState().unlockedAt < 600
