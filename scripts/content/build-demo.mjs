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
  ...(c.style ? { style: c.style } : {}),
  ...(c.works ? { works: c.works } : {}),
  ...(c.catalogOnly ? { catalogOnly: true } : {}),
  ...(c.followers ? { followers: c.followers } : {}),
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
  // catalogue-only creators: heard through a connected service, not yet in CIRCA's feeds
  'odessa-wren': { plays: 34, completions: 30, minutes: 118, repeats: 22, saves: 2 },
  'velvet-hours': { plays: 16, completions: 13, minutes: 52, repeats: 6, saves: 1 },
  'nadia-okoro': { plays: 9, completions: 6, minutes: 74, repeats: 2 },
  'eli-marchetti': { plays: 7, completions: 5, minutes: 31, repeats: 2 },
  'sora-lake': { plays: 5, completions: 3, minutes: 14, repeats: 1 },
  'lumen-field': { plays: 4, completions: 2, minutes: 22 },
  'wren-hollow': { plays: 3, completions: 2, minutes: 9 },
  'kwame-asante': { plays: 2, completions: 1, minutes: 8 },
  'studio-floor': { plays: 6, completions: 5, minutes: 205, saves: 1 },
  'slow-cities': { plays: 2, completions: 1, minutes: 48 },
}

// Sample CIRCA listeners (fictional) and the demo user's starting profile.
const social = read('content/demo/people.json')
const people = social.people.map((p) => ({
  ...p,
  avatar: `media/people/${p.id}.jpg`,
  experiences: p.experiences.map((x, i) => ({ id: `x-${p.id}-${i + 1}`, ...x })),
}))

// ---- real creators: content/real/library.json -----------------------------
// One file holds every real creator and their videos. Songs join Music and
// the Radio, episodes join the Radio, innerCircle posts join Inner Circle.
// Everything plays through the platform's official embed.
const lib = read('content/real/library.json')
const YT = /^[\w-]{11}$/
const mediaFor = (item, where) => {
  if (item.playback === 'youtube') {
    if (!YT.test(item.videoId ?? '')) throw new Error(`${where}: videoId must be an 11-character YouTube id`)
    for (const k of ['url', 'embedUrl', 'thumbnail'])
      if (item[k] && !item[k].includes(item.videoId)) throw new Error(`${where}: ${k} does not match videoId ${item.videoId}`)
    return { kind: 'youtube', id: item.videoId }
  }
  if (item.playback === 'instagram') {
    const code = item.url?.match(/instagram\.com\/(?:reel|reels|p)\/([\w-]+)/)?.[1]
    if (!code) throw new Error(`${where}: instagram needs a reel or post url`)
    return { kind: 'embed', provider: 'instagram', src: `https://www.instagram.com/reel/${code}/embed/`, url: item.url }
  }
  if (item.playback === 'video') return { kind: 'video', src: item.src, ...(item.poster ? { poster: item.poster } : {}) }
  throw new Error(`${where}: unknown playback "${item.playback}"`)
}
const real = { creators: [], songs: [], episodes: [], innerCircle: [] }
lib.creators.forEach((c) => {
  if (creators.some((x) => x.id === c.id)) throw new Error(`creator id ${c.id} is already taken`)
  real.creators.push({
    id: c.id,
    kind: c.type,
    name: c.name,
    // the channel picture when we have it; until then, a frame from their own video
    avatar: c.profileImage ?? c.profileImageFallback,
    genre: c.genre.split(',')[0].trim(),
    genres: c.genre,
    bio: c.description,
    ...(c.hosts ? { hosts: c.hosts } : {}),
    palette: c.palette,
    ...(c.style ? { style: c.style } : {}),
    ...(c.followers ? { followers: c.followers } : {}),
    channel: { ...c.channel, platform: 'YouTube' },
  })
  c.content.forEach((item, n) => {
    // fill (cropped to a vertical reel) or fit (whole, 16:9): per item, else per creator type
    const display = item.display ?? lib.display?.[c.type] ?? 'fit'
    const where = `${c.id} content[${n}] (${item.id})`
    const media = mediaFor(item, where)
    const source = { url: item.url, title: item.title }
    if (item.role === 'song')
      real.songs.push({
        id: item.id,
        creatorId: c.id,
        title: item.title,
        release: item.release ?? 'Single',
        year: item.year,
        blurb: item.blurb ?? '',
        mood: item.mood ?? [],
        artwork: item.thumbnail ?? '',
        media,
        preview: { start: item.preview?.start ?? 0, end: item.preview?.end ?? (item.preview?.start ?? 0) + 180 },
        ...(item.duration ? { duration: item.duration } : {}),
        display,
        source,
      })
    else if (item.role === 'episode')
      real.episodes.push({
        id: item.id,
        creatorId: c.id,
        title: item.title,
        guests: item.guests ?? [],
        topic: item.topic ?? '',
        artwork: item.thumbnail ?? '',
        media,
        ...(item.duration ? { duration: item.duration } : {}),
        highlight: item.highlight,
        display,
        source,
      })
    else if (item.role === 'innerCircle')
      real.innerCircle.push({
        id: item.id,
        creatorId: c.id,
        caption: item.caption,
        context: item.context ?? '',
        postedHoursAgo: item.postedHoursAgo ?? 2 + real.innerCircle.length * 3,
        media,
        ...(item.thumbnail ? { poster: item.thumbnail } : {}),
        ...(item.orientation ? { orientation: item.orientation } : {}),
        display,
        source,
      })
    else throw new Error(`${where}: role must be song, episode or innerCircle`)
  })
})
// real and original work take turns, real first
const weave = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]]).flat().filter(Boolean)
const { note: _note, ...realListening } = lib.listening ?? {}

const out = {
  version: 1,
  name: 'CIRCA demo content',
  notes:
    'Real creators from content/real/library.json play through official YouTube embeds. Every other artist, show, person and media file is original and fictional, generated for the prototype. Listening figures are simulated throughout.',
  creators: [...real.creators, ...creators],
  songs: weave(real.songs, songs),
  episodes: weave(real.episodes, episodes),
  innerCircle: [...real.innerCircle, ...innerCircle],
  listeningSeed: { ...realListening, ...listeningSeed },
  defaultFollows: [...new Set([...(lib.follows ?? []), ...cat.defaultFollows])],
  people,
  me: social.me,
  comments: social.comments,
  creatorVinyls: social.creatorVinyls,
  communities: social.communities,
}
writeFileSync(new URL('public/content/demo.json', root), JSON.stringify(out, null, 1))
console.log(`demo.json: ${out.creators.length} creators (${real.creators.length} real), ${out.songs.length} songs, ${out.episodes.length} episodes, ${out.innerCircle.length} posts, ${people.length} people`)
