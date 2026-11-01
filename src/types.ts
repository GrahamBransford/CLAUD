export type CreatorKind = 'artist' | 'podcast'

/**
 * Where a piece of media plays from. Content files choose the method per item.
 *  - video / audio: a file URL (self-hosted, or a podcast RSS enclosure)
 *  - youtube: an official YouTube upload, played through the YouTube IFrame Player API
 *  - spotify: a Spotify URI, played through the Spotify embed (iFrame API)
 *  - embed: another platform's official embed page (e.g. an Instagram Reel). It
 *    plays in that platform's own player; CIRCA can't drive it.
 *  - image: a still
 */
export type MediaSource =
  | { kind: 'video'; src: string; poster?: string }
  | { kind: 'audio'; src: string }
  | { kind: 'youtube'; id: string }
  | { kind: 'spotify'; uri: string }
  | { kind: 'embed'; provider: string; src: string; url?: string }
  | { kind: 'image'; src: string }

/** Where a real piece of work lives on its platform: "Watch on YouTube", only when asked. */
export interface SourceLink {
  url: string
  title?: string
}

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
  /** A broader family for grouping (e.g. "Soul & R&B" holds bedroom soul and neo-soul). */
  style?: string
  /** Song or episode titles, for creators whose catalogue isn't playable in CIRCA. */
  works?: string[]
  /** Heard through a connected service; not yet in CIRCA's feeds. */
  catalogOnly?: boolean
  /** Followers on CIRCA (demo figure). */
  followers?: number
  links?: { label: string; url: string }[]
  /** The full genre line, when `genre` is its short form. */
  genres?: string
  /** A real creator's official channel. */
  channel?: { platform: string; handle: string; url: string }
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
  source?: SourceLink
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
  source?: SourceLink
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
  /** Horizontal sources keep their shape inside the vertical feed. */
  orientation?: 'vertical' | 'horizontal'
  source?: SourceLink
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
  /** Sample comments on Inner Circle moments, by post id. */
  comments?: Record<string, PostComment[]>
  /** Communities around creators: curated by them, or run by fans. */
  communities?: Community[]
  /** What the creators themselves listen to: their own vinyls. */
  creatorVinyls?: Record<string, { points: Record<string, number>; experiences: Omit<Experience, 'id'>[] }>
}

/** A comment on an Inner Circle moment, by a listener or by the creator. */
export interface PostComment {
  /** A person id, or the creator's id for their own replies. */
  by: string
  text: string
  /** As displayed, e.g. "2h". */
  ago: string
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

/** Latitude, longitude: where someone is, roughly (demo data). */
export type Coords = [number, number]

export interface MeSeed extends Profile {
  coords?: Coords
  experiences: Experience[]
  favorites: string[]
  friends: Record<string, FriendState>
  awards?: Award[]
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
  coords?: Coords
  /** Set when this vinyl belongs to a creator rather than a listener. */
  creatorId?: string
  /** What they've earned or do: hosting, industry roles, top-listener status. */
  awards?: Award[]
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

/**
 * A community around a creator: one they curate themselves, or one their
 * fans run. Online, in person, or both. (Demo data: fictional groups.)
 */
export interface Community {
  id: string
  name: string
  creatorId: string
  by: 'creator' | 'fans'
  format: 'Online' | 'In person' | 'Online + in person'
  city?: string
  coords?: Coords
  members: number
  rhythm: string
  about: string
  styles: (string | undefined)[]
  /** Sample listeners who are members. */
  memberIds: string[]
  next: { title: string; inDays: number; place: string }
}

/**
 * Something a listener has earned or does, shown on their vinyl. Hosting and
 * top-listener status come from CIRCA; industry roles are self-reported.
 */
export interface Award {
  kind: 'host' | 'industry' | 'top' | 'tastemaker' | 'founding'
  title: string
  detail: string
  /** For hosts: the community they run gatherings for. */
  communityId?: string
}
