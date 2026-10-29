import catalog from './catalog.json'
import media from './media.json'
import type { Creator, Episode, HandheldPost, Song } from '../types'

/** Media paths are stored relative so the app can be served from any base path. */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

type MediaManifest = typeof media

const m = media as MediaManifest

export const creators: Creator[] = catalog.creators.map((c) => ({
  ...c,
  kind: c.kind as Creator['kind'],
  avatar: asset(`media/avatars/${c.id}.jpg`),
}))

export const creatorById = Object.fromEntries(creators.map((c) => [c.id, c])) as Record<string, Creator>

export const songs: Song[] = catalog.songs.map((s) => {
  const sm = m.songs[s.id as keyof MediaManifest['songs']]
  return {
    id: s.id,
    creatorId: s.creatorId,
    title: s.title,
    release: s.release,
    year: s.year,
    blurb: s.blurb,
    mood: s.mood,
    cover: asset(`media/covers/${s.id}.jpg`),
    video: asset(sm.video),
    poster: asset(sm.poster),
    duration: sm.duration,
    previewStart: s.preview.start,
    // the generated media knows where the musical phrase actually ends
    previewEnd: sm.previewEnd,
  }
})

export const episodes: Episode[] = catalog.episodes.map((e) => {
  const em = m.episodes[e.id as keyof MediaManifest['episodes']]
  return {
    ...e,
    art: asset(`media/podcast-art/${e.creatorId}.jpg`),
    speakers: em.speakers,
    full: { video: asset(em.full.video), poster: asset(em.full.poster), duration: em.full.duration },
    highlight: {
      video: asset(em.highlight.video),
      poster: asset(em.highlight.poster),
      duration: em.highlight.duration,
      sourceStart: em.highlight.sourceStart,
      sourceEnd: em.highlight.sourceEnd,
    },
    chapters: em.chapters,
    cues: em.cues,
    highlightCues: em.highlightCues,
  }
})

export const posts: HandheldPost[] = catalog.handhelds.map((h) => {
  const hm = m.handhelds[h.id as keyof MediaManifest['handhelds']] as {
    src: string
    poster: string
    duration?: number
  }
  return {
    ...h,
    type: h.type as HandheldPost['type'],
    src: asset(hm.src),
    poster: asset(hm.poster),
    duration: hm.duration,
  }
})

export const songById = Object.fromEntries(songs.map((s) => [s.id, s])) as Record<string, Song>
export const episodeById = Object.fromEntries(episodes.map((e) => [e.id, e])) as Record<string, Episode>

export const listeningSeed = catalog.listeningSeed.creators as Record<
  string,
  { plays: number; completion: number; saves: number }
>
export const defaultFollows: string[] = catalog.defaultFollows

export const workByCreator = (creatorId: string) => ({
  songs: songs.filter((s) => s.creatorId === creatorId),
  episodes: episodes.filter((e) => e.creatorId === creatorId),
  posts: posts.filter((p) => p.creatorId === creatorId),
})
