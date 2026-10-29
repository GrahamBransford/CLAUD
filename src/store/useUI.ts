import { create } from 'zustand'

export interface Toast {
  id: number
  title: string
  detail?: string
  image?: string
  tone?: 'save' | 'info' | 'follow'
  action?: { label: string; run: () => void }
}

export type Sheet = { kind: 'library' } | { kind: 'profile'; creatorId: string } | { kind: 'tuning' } | null

export interface FullEpisodeRequest {
  episodeId: string
  startAt: number
  reason: 'auto' | 'manual' | 'library'
}

/** Ephemeral UI state; never persisted. */
interface UIState {
  toasts: Toast[]
  sheet: Sheet
  fullEpisode: FullEpisodeRequest | null
  drive: boolean
  /** Browsers only allow audible autoplay after a gesture; set by "Tune in". */
  audioUnlocked: boolean
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  openSheet: (s: Sheet) => void
  openFullEpisode: (r: FullEpisodeRequest | null) => void
  setDrive: (on: boolean) => void
  unlockAudio: () => void
}

let nextId = 1

export const useUI = create<UIState>()((set, get) => ({
  toasts: [],
  sheet: null,
  fullEpisode: null,
  drive: false,
  audioUnlocked: false,
  pushToast: (t) => {
    const id = nextId++
    set((st) => ({ toasts: [...st.toasts.slice(-2), { ...t, id }] }))
    window.setTimeout(() => get().dismissToast(id), 3600)
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  openSheet: (sheet) => set({ sheet }),
  openFullEpisode: (fullEpisode) => set({ fullEpisode }),
  setDrive: (drive) => set({ drive }),
  unlockAudio: () => set({ audioUnlocked: true }),
}))
