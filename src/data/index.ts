import type { ContentSet, Creator, Episode, InnerCirclePost, MediaSource, MeSeed, Person, PostComment, Signals, Song } from '../types'

/**
 * Content is loaded at runtime from public/content/<set>.json, so artists,
 * videos, episodes and Inner Circle posts can be added or replaced by editing
 * JSON — no rebuild. public/content/index.json lists the available sets.
 *
 * The arrays below are live ES-module bindings: they are filled once by
 * loadContent() before the app renders.
 */

/** Relative paths resolve against the app's base; absolute URLs pass through. */
export const asset = (path: string) =>
  /^(https?:|data:|blob:)/.test(path) ? path : `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

export interface ContentIndex {
  default: string
  sets: { id: string; file: string; label: string; description?: string }[]
}

export let contentIndex: ContentIndex = { default: 'demo', sets: [] }
export let activeSet = 'demo'
export let contentName = ''
export let creators: Creator[] = []
export let songs: Song[] = []
export let episodes: Episode[] = []
export let innerCircle: InnerCirclePost[] = []
export let listeningSeed: Record<string, Partial<Signals>> = {}
export let defaultFollows: string[] = []
export let creatorById: Record<string, Creator> = {}
export let songById: Record<string, Song> = {}
export let episodeById: Record<string, Episode> = {}
export let people: Person[] = []
export let personById: Record<string, Person> = {}
export let commentsByPost: Record<string, PostComment[]> = {}
export let meSeed: MeSeed = { name: '', username: '', bio: '', location: '', avatar: '', socials: {}, experiences: [], favorites: [], friends: {} }

const SET_KEY = 'circa-content-set'

const resolveMedia = (m: MediaSource): MediaSource => {
  if (m.kind === 'video') return { ...m, src: asset(m.src), poster: m.poster ? asset(m.poster) : undefined }
  if (m.kind === 'audio' || m.kind === 'image') return { ...m, src: asset(m.src) }
  return m
}

/** YouTube thumbnails stand in for artwork when a content entry gives none. */
const artworkFor = (art: string | undefined, m: MediaSource) =>
  art ? asset(art) : m.kind === 'youtube' ? `https://i.ytimg.com/vi/${m.id}/hqdefault.jpg` : ''

export function chosenSet() {
  const fromUrl = new URLSearchParams(window.location.search).get('content')
  if (fromUrl) return fromUrl
  try {
    return localStorage.getItem(SET_KEY) ?? ''
  } catch {
    return ''
  }
}

export function chooseSet(id: string) {
  try {
    localStorage.setItem(SET_KEY, id)
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('content')
  window.location.replace(url.toString())
}

export async function loadContent(): Promise<void> {
  try {
    const res = await fetch(asset('content/index.json'), { cache: 'no-cache' })
    if (res.ok) contentIndex = await res.json()
  } catch {
    /* no index: fall back to the demo set */
  }
  const wanted = chosenSet()
  const entry = contentIndex.sets.find((s) => s.id === wanted) ?? contentIndex.sets.find((s) => s.id === contentIndex.default)
  activeSet = entry?.id ?? 'demo'
  const res = await fetch(asset(`content/${entry?.file ?? 'demo.json'}`), { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Could not load content/${entry?.file ?? 'demo.json'} (${res.status})`)
  const set = (await res.json()) as ContentSet
  contentName = set.name

  creators = set.creators.map((c) => ({ ...c, avatar: asset(c.avatar) }))
  songs = set.songs.map((s) => ({
    ...s,
    media: resolveMedia(s.media),
    audio: s.audio ? resolveMedia(s.audio) : undefined,
    artwork: artworkFor(s.artwork, s.media),
  }))
  episodes = set.episodes.map((e) => ({
    ...e,
    guests: e.guests ?? [],
    media: resolveMedia(e.media),
    audio: e.audio ? resolveMedia(e.audio) : undefined,
    artwork: artworkFor(e.artwork, e.media),
  }))
  innerCircle = set.innerCircle.map((p) => ({
    ...p,
    media: resolveMedia(p.media),
    poster: p.poster ? asset(p.poster) : p.media.kind === 'youtube' ? `https://i.ytimg.com/vi/${p.media.id}/hqdefault.jpg` : undefined,
  }))
  listeningSeed = set.listeningSeed ?? {}
  defaultFollows = set.defaultFollows ?? []
  creatorById = Object.fromEntries(creators.map((c) => [c.id, c]))
  songById = Object.fromEntries(songs.map((s) => [s.id, s]))
  episodeById = Object.fromEntries(episodes.map((e) => [e.id, e]))
  people = (set.people ?? []).map((p) => ({ ...p, avatar: asset(p.avatar) }))
  personById = Object.fromEntries(people.map((p) => [p.id, p]))
  commentsByPost = set.comments ?? {}
  if (set.me) meSeed = { ...set.me, avatar: set.me.avatar ? asset(set.me.avatar) : '' }
}

export const workByCreator = (creatorId: string) => ({
  songs: songs.filter((s) => s.creatorId === creatorId),
  episodes: episodes.filter((e) => e.creatorId === creatorId),
  posts: innerCircle.filter((p) => p.creatorId === creatorId),
})

export const creatorOfItem = (id: string) => songById[id]?.creatorId ?? episodeById[id]?.creatorId
