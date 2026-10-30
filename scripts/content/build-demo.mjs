// Builds public/content/demo.json — CIRCA's original, offline-safe demo
// content — from the generator sources in content/demo/.
// Usage: node scripts/content/build-demo.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../../', import.meta.url)
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'))
const cat = read('content/demo/catalog.json')
const media = read('content/demo/media.json')

const creators = cat.creators.map((c) => ({
  id: c.id,
  kind: c.kind,
  name: c.name,
  avatar: `media/avatars/${c.id}.jpg`,
  genre: c.genre,
  bio: c.bio,
  ...(c.location ? { location: c.location } : {}),
  ...(c.hosts ? { hosts: c.hosts } : {}),
  palette: c.palette,
}))

const songs = cat.songs.map((s) => {
  const m = media.songs[s.id]
  return {
    id: s.id,
    creatorId: s.creatorId,
    title: s.title,
    release: s.release,
    year: s.year,
    blurb: s.blurb,
    mood: s.mood,
    artwork: `media/covers/${s.id}.jpg`,
    media: { kind: 'video', src: m.video, poster: m.poster },
    audio: { kind: 'audio', src: m.video },
    preview: { start: s.preview.start, end: m.previewEnd },
    duration: m.duration,
  }
})

const episodes = cat.episodes.map((e) => {
  const m = media.episodes[e.id]
  return {
    id: e.id,
    creatorId: e.creatorId,
    number: e.number,
    title: e.title,
    guests: e.guests,
    topic: e.topic,
    artwork: `media/podcast-art/${e.creatorId}.jpg`,
    media: { kind: 'video', src: m.full.video, poster: m.highlight.poster },
    audio: { kind: 'audio', src: m.full.video },
    duration: m.full.duration,
    highlight: { start: m.highlight.sourceStart, end: m.highlight.sourceEnd, title: e.highlightTitle },
    speakers: m.speakers,
    chapters: m.chapters,
    cues: m.cues,
  }
})

const innerCircle = cat.handhelds.map((h) => {
  const m = media.handhelds[h.id]
  return {
    id: h.id,
    creatorId: h.creatorId,
    caption: h.caption,
    context: h.context,
    postedHoursAgo: h.postedHoursAgo,
    media: h.type === 'video' ? { kind: 'video', src: m.src, poster: m.poster } : { kind: 'image', src: m.src },
    poster: m.poster,
    ...(m.duration ? { duration: m.duration } : {}),
  }
})

// Simulated listening history (stands in for connected streaming data).
const listeningSeed = {
  'juniper-vale': { plays: 52, completions: 48, minutes: 140, repeats: 44, saves: 3, concerts: 2 },
  'long-way-round': { plays: 9, completions: 8, minutes: 262, repeats: 0, saves: 2 },
  'cass-ferro': { plays: 12, completions: 8, minutes: 24, repeats: 6, saves: 1 },
  'teodora-blue': { plays: 4, completions: 2, minutes: 6, repeats: 1 },
  'small-machines': { plays: 2, completions: 1, minutes: 24 },
  'marlow-saltwater': { plays: 2, completions: 1, minutes: 3 },
  halden: { plays: 1, minutes: 1 },
}

// Sample CIRCA listeners (fictional) and the demo user's starting profile.
const social = read('content/demo/people.json')
const people = social.people.map((p) => ({
  ...p,
  avatar: `media/people/${p.id}.jpg`,
  experiences: p.experiences.map((x, i) => ({ id: `x-${p.id}-${i + 1}`, ...x })),
}))

const out = {
  version: 1,
  name: 'CIRCA original demo content',
  notes:
    'All artists, shows, people and media in this set are original and fictional, generated for the prototype. Works offline.',
  creators,
  songs,
  episodes,
  innerCircle,
  listeningSeed,
  defaultFollows: cat.defaultFollows,
  people,
  me: social.me,
  comments: social.comments,
}
writeFileSync(new URL('public/content/demo.json', root), JSON.stringify(out, null, 1))
console.log(`demo.json: ${creators.length} creators, ${songs.length} songs, ${episodes.length} episodes, ${innerCircle.length} posts, ${people.length} people`)
