// Builds public/content/demo.json from two sources:
//   content/real/library.json  every creator and every video (the one place to edit them)
//   content/demo/people.json   sample CIRCA listeners, the demo user, comments, communities
// Usage: node scripts/content/build-demo.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../../', import.meta.url)
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'))
const lib = read('content/real/library.json')
const social = read('content/demo/people.json')

const YT = /^[\w-]{11}$/
const local = (path, where) => {
  if (!existsSync(new URL(`public/${path}`, root))) throw new Error(`${where}: public/${path} is missing`)
  return path
}
const mediaFor = (item, where) => {
  if (item.playback === 'video') return { kind: 'video', src: local(item.src, where), ...(item.poster ? { poster: local(item.poster, where) } : {}) }
  if (item.playback === 'youtube') {
    if (!YT.test(item.videoId ?? '')) throw new Error(`${where}: videoId must be an 11-character YouTube id`)
    return { kind: 'youtube', id: item.videoId }
  }
  if (item.playback === 'instagram') {
    const code = item.url?.match(/instagram\.com\/(?:reel|reels|p)\/([\w-]+)/)?.[1]
    if (!code) throw new Error(`${where}: instagram needs a reel or post url`)
    return { kind: 'embed', provider: 'instagram', src: `https://www.instagram.com/reel/${code}/embed/`, url: item.url }
  }
  throw new Error(`${where}: unknown playback "${item.playback}"`)
}

const creators = []
const songs = []
const episodes = []
const innerCircle = []
const credits = []

for (const c of lib.creators) {
  if (creators.some((x) => x.id === c.id)) throw new Error(`creator id ${c.id} is used twice`)
  creators.push({
    id: c.id,
    kind: c.type,
    name: c.name,
    avatar: local(c.profileImage, c.id),
    genre: c.genre.split(',')[0].trim(),
    ...(c.genre.includes(',') ? { genres: c.genre } : {}),
    bio: c.description,
    ...(c.location ? { location: c.location } : {}),
    ...(c.hosts ? { hosts: c.hosts } : {}),
    palette: c.palette,
    ...(c.style ? { style: c.style } : {}),
    ...(c.followers ? { followers: c.followers } : {}),
    ...(c.channel ? { channel: { ...c.channel, platform: 'YouTube' } } : {}),
  })
  c.content.forEach((item, n) => {
    const where = `${c.id} content[${n}] (${item.id})`
    const media = mediaFor(item, where)
    const display = item.display ?? lib.display?.[c.type] ?? 'fit'
    const poster = item.poster ?? item.thumbnail ?? ''
    if (item.credits) credits.push({ id: item.id, creatorId: c.id, title: item.title ?? item.caption, ...item.credits })
    if (item.role === 'song')
      songs.push({
        id: item.id,
        creatorId: c.id,
        title: item.title,
        release: item.release ?? 'Single',
        year: item.year,
        blurb: item.blurb ?? '',
        mood: item.mood ?? [],
        artwork: poster,
        media,
        ...(media.kind === 'video' ? { audio: { kind: 'audio', src: media.src } } : {}),
        preview: { start: item.preview?.start ?? 0, end: item.preview?.end ?? Math.min(item.duration ?? 180, (item.preview?.start ?? 0) + 180) },
        ...(item.duration ? { duration: item.duration } : {}),
        display,
      })
    else if (item.role === 'episode')
      episodes.push({
        id: item.id,
        creatorId: c.id,
        title: item.title,
        guests: item.guests ?? [],
        topic: item.topic ?? '',
        artwork: poster,
        ...(item.published ? { published: item.published } : {}),
        media,
        ...(media.kind === 'video' ? { audio: { kind: 'audio', src: media.src } } : {}),
        ...(item.duration ? { duration: item.duration } : {}),
        highlight: item.highlight,
        ...(item.cues?.length ? { cues: item.cues } : {}),
        display,
      })
    else if (item.role === 'innerCircle')
      innerCircle.push({
        id: item.id,
        creatorId: c.id,
        caption: item.caption,
        context: item.context ?? '',
        postedHoursAgo: item.postedHoursAgo ?? 2 + innerCircle.length * 3,
        media,
        ...(poster ? { poster } : {}),
        ...(item.duration ? { duration: item.duration } : {}),
        ...(item.orientation ? { orientation: item.orientation } : {}),
        display,
      })
    else throw new Error(`${where}: role must be song, episode or innerCircle`)
  })
}

// Sample CIRCA listeners (fictional) and the demo user's starting profile.
const known = new Set(creators.map((c) => c.id))
const people = social.people.map((p) => {
  for (const id of Object.keys(p.points)) if (!known.has(id)) throw new Error(`${p.id}: points for unknown creator ${id}`)
  return { ...p, avatar: `media/people/${p.id}.jpg`, experiences: p.experiences.map((x, i) => ({ id: `x-${p.id}-${i + 1}`, ...x })) }
})
for (const cm of social.communities) if (!known.has(cm.creatorId)) throw new Error(`${cm.id}: unknown creator ${cm.creatorId}`)
for (const id of Object.keys(social.comments)) if (!innerCircle.some((p) => p.id === id)) throw new Error(`comments for unknown post ${id}`)

const { note: _note, ...listeningSeed } = lib.listening ?? {}
const out = {
  version: 1,
  name: 'CIRCA demo content',
  notes: `${lib.sources.artists} ${lib.sources.podcasts} Sample listeners and every listening figure are simulated.`,
  creators,
  songs,
  episodes,
  innerCircle,
  listeningSeed,
  defaultFollows: lib.follows ?? [],
  people,
  me: social.me,
  comments: social.comments,
  creatorVinyls: social.creatorVinyls,
  communities: social.communities,
  credits,
}
writeFileSync(new URL('public/content/demo.json', root), JSON.stringify(out, null, 1))
console.log(`demo.json: ${creators.length} creators, ${songs.length} songs, ${episodes.length} episodes, ${innerCircle.length} posts, ${people.length} people, ${credits.length} credits`)
