export type CreatorKind = 'artist' | 'podcast'

/**
 * Where a piece of media plays from. Content files choose the method per item.
 *  - video / audio: a file URL (self-hosted, or a podcast RSS enclosure)
 *  - youtube: an official YouTube upload, played through the YouTube IFrame Player API
 *  - spotify: a Spotify URI, played through the Spotify embed (iFrame API)
 *  - image: a still
 */
export type MediaSource =
  | { kind: 'video'; src: string; poster?: string }
  | { kind: 'audio'; src: string }
  | { kind: 'youtube'; id: string }
  | { kind: 'spotify'; uri: string }
  | { kind: 'image'; src: string }

export interface Creator {
  id: string
  kind: CreatorKind
  name: string
  avatar: string
  genre: string
  bio: string
  location?: string
  hosts?: string[]
  /** Two or three brand colours used for markers and accents. */
  palette: string[]
  links?: { label: string; url: string }[]
}

export interface Song {
  id: string
  creatorId: string
  title: string
  release: string
  year: number
  blurb: string
  mood: string[]
  artwork: string
  /** What plays on the discovery card (usually the music video). */
  media: MediaSource
  /** Audio-only alternative for Drive mode (Spotify or an audio file). */
  audio?: MediaSource
  /** Discovery window inside the media, in seconds. */
  preview: { start: number; end: number }
  /** Full length, when known (seconds). */
  duration?: number
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
  number?: number
  title: string
  guests: string[]
  topic: string
  artwork: string
  published?: string
  /** The complete episode. The highlight is a window inside it. */
  media: MediaSource
  /** Audio-only alternative for Drive mode. */
  audio?: MediaSource
  duration?: number
  highlight: { start: number; end: number; title: string; note?: string }
  /** Highlight timing in the audio rendition, when it differs from the video (e.g. RSS intros/ads). */
  audioHighlight?: { start: number; end: number }
  speakers?: Record<string, { name: string }>
  chapters?: Chapter[]
  cues?: Cue[]
}

export interface InnerCirclePost {
  id: string
  creatorId: string
  caption: string
  context: string
  postedHoursAgo: number
  media: MediaSource
  poster?: string
  duration?: number
}

export interface ContentSet {
  version: number
  name: string
  notes?: string
  creators: Creator[]
  songs: Song[]
  episodes: Episode[]
  innerCircle: InnerCirclePost[]
  /** Simulated history standing in for connected streaming data. */
  listeningSeed: Record<string, Partial<Signals>>
  defaultFollows: string[]
  /** Sample CIRCA listeners (fictional), for friends, search and shared taste. */
  people?: Person[]
  /** The demo user's starting profile. */
  me?: MeSeed
}

// ---- people & identity ----------------------------------------------------

export type ExperienceKind = 'concert' | 'festival' | 'performance' | 'other'

/** Something someone lived through. Self-reported: never verified. */
export interface Experience {
  id: string
  kind: ExperienceKind
  title: string
  creatorId?: string
  place?: string
  year?: number
}

export interface Socials {
  instagram?: string
  website?: string
}

export interface Profile {
  name: string
  username: string
  bio: string
  location: string
  avatar: string
  socials: Socials
}

/** Your side of a friendship. */
export type FriendState = 'friends' | 'outgoing' | 'incoming'

export interface MeSeed extends Profile {
  experiences: Experience[]
  favorites: string[]
  friends: Record<string, FriendState>
}

export interface Person {
  id: string
  name: string
  username: string
  bio: string
  location?: string
  avatar: string
  socials?: Socials
  /** Simulated engagement points per creator (the same scale as yours). */
  points: Record<string, number>
  experiences: Experience[]
  friends: string[]
  /** Simulated recent changes to their vinyl. */
  recent?: string[]
}

export type SaveMethod = 'swipe' | 'button' | 'listened'

export interface SavedItem {
  id: string
  kind: 'song' | 'episode'
  savedAt: number
  via: SaveMethod
}

/** Engagement signals for one creator. All values are counts or minutes. */
export interface Signals {
  minutes: number
  completions: number
  /** Plays of something already heard before. */
  repeats: number
  plays: number
  concerts: number
  /** Light-touch reactions in Inner Circle (deliberately weighted low). */
  reactions: number
  /** Inner Circle posts watched most of the way through. */
  views: number
}
