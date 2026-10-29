export type CreatorKind = 'artist' | 'podcast'

export interface Creator {
  id: string
  kind: CreatorKind
  name: string
  handle: string
  location?: string
  genre: string
  bio: string
  hosts?: string[]
  palette: string[]
  avatar: string
}

export interface Song {
  id: string
  creatorId: string
  title: string
  release: string
  year: number
  blurb: string
  mood: string[]
  cover: string
  video: string
  poster: string
  /** Length of the full track / video in seconds. */
  duration: number
  /** The discovery window inside the full video, in seconds. */
  previewStart: number
  previewEnd: number
}

export interface Cue {
  start: number
  end: number
  speaker: string
  text: string
}

export interface Chapter {
  title: string
  start: number
}

export interface Episode {
  id: string
  creatorId: string
  number: number
  title: string
  guests: string[]
  topic: string
  highlightTitle: string
  art: string
  speakers: Record<string, { name: string }>
  full: { video: string; poster: string; duration: number }
  highlight: {
    video: string
    poster: string
    duration: number
    /** Where the highlight sits inside the full episode. */
    sourceStart: number
    sourceEnd: number
  }
  chapters: Chapter[]
  cues: Cue[]
  highlightCues: Cue[]
}

export interface HandheldPost {
  id: string
  creatorId: string
  type: 'video' | 'image'
  caption: string
  context: string
  postedHoursAgo: number
  src: string
  poster: string
  duration?: number
}

export type SaveMethod = 'swipe' | 'button' | 'listened'

export interface SavedItem {
  id: string
  kind: 'song' | 'episode'
  savedAt: number
  via: SaveMethod
}

/** Listening activity recorded inside the app for one creator. */
export interface CreatorListening {
  plays: number
  completionSum: number
  completionCount: number
  saves: number
  seconds: number
}
