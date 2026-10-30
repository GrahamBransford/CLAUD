# CIRCA — creative discovery prototype

A new kind of radio. Discover music and conversations, and watch your relationship with the people behind them grow, from the outer edge of your record to the centre.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also prints a Network address for phones on the same Wi-Fi)
npm run build      # static site in dist/ — host anywhere (Netlify, any web server)
```

## What's in it

| Destination | What it does |
| --- | --- |
| **Your Record** (home) | A turntable view of everyone you listen to. Creators sit on the record by how close you are: Discovered at the outer edge, then Regular, Devoted, Inner Circle, and Top 1% at the centre. Tap anyone for tier, estimated percentile, statistics, what moves them inward, and the demo reward card. |
| **Artists** | Music discovery. Each card plays the song's video for a 60–90 s preview. Swipe right to **SAVE**, left to **PASS**, or use the buttons / arrow keys. Hearing the whole preview saves the song automatically. |
| **Podcasts** | Conversation discovery. A ~5-minute highlight from inside a longer episode. Finish it and the full episode keeps playing from right after the highlight. "Watch / Listen to full episode" continues from the exact moment. Audio-only episodes are presented as audio. |
| **Inner Circle** | A full-screen, sideways feed of unpolished, behind-the-scenes moments, only from creators you follow, closest relationships first. Swipe right for the next moment, left to go back. |
| **Drive** | Simulated CarPlay / Android Auto: no moving video, still artwork, big controls, audio only. Auto-save and highlight→episode keep working. Includes a glanceable Your Record. |
| **Collection** | Saved songs and episodes, simulated streaming destination, content-set switch, demo reset. |

### How closeness works

Points per creator come from meaningful signals (`src/lib/affinity.ts`):
minutes listened (1/min), full listens (8), coming back to something (5), saves (12), following (20), **shows attended (90)**, Inner Circle moments watched (3), reactions (1). Points become an **estimated** percentile against a modelled audience for that creator, which sets the tier and the position on the record. Everything you do in the app moves creators; the demo also starts from a simulated listening history. **Percentiles are estimates, not verified rankings,** and the UI says so.

To demo the top tier: on Your Record, tap Juniper Vale → **I went to a show**. She crosses into the Top 1% and the reward card unlocks.

## Content: real media without rebuilding

Content is loaded at runtime from `public/content/` (or `dist/content/` after a build), so you can add or replace artists, videos, episodes and Inner Circle moments by editing JSON and reloading.

- `public/content/index.json` lists the content sets and which one is the default. The Collection panel switches between sets; `?content=<id>` in the URL does too.
- `public/content/demo.json` is the original, fully offline demo set (fictional creators, generated media).
- `public/content/real.json` is the starter for real artists and podcasts. Add it to `index.json` once it has items.

Every item names its creator, metadata and a **media source**:

```json
{ "kind": "youtube", "id": "VIDEO_ID" }            // official YouTube video, via the YouTube IFrame Player API
{ "kind": "spotify", "uri": "spotify:track:ID" }    // Spotify embed (iFrame API)
{ "kind": "audio",   "src": "https://…/episode.mp3" } // e.g. a podcast RSS enclosure
{ "kind": "video",   "src": "media/clip.mp4" }       // a self-hosted file
{ "kind": "image",   "src": "media/photo.jpg" }
```

Songs: `media` (the video), optional `audio` (Spotify or a file, used in Drive), `preview: {start, end}`.
Episodes: `media` (the full episode), optional `audio`, `highlight: {start, end, title}` inside it, optional `audioHighlight` when the audio's timing differs.

### Helpers

```bash
# Add an official YouTube music video (checked via YouTube oEmbed; refuses private or non-embeddable videos)
npm run content:youtube -- "https://www.youtube.com/watch?v=…" --creator some-artist --into public/content/real.json --preview 30-105
# … or an Inner Circle moment (e.g. an official YouTube Short)
npm run content:youtube -- "https://youtube.com/shorts/…" --creator some-artist --as moment --into public/content/real.json

# Import real episodes (titles, hosts, artwork, descriptions, audio) from a public podcast RSS feed
npm run content:podcast -- https://feeds.example.com/show.xml --episodes 3 --into public/content/real.json

# Check every item in a set actually plays (YouTube embeddable? Spotify ID real? files reachable?)
npm run content:verify -- public/content/real.json
```

Creators need an entry in `creators` (an artist's id, name, avatar URL, genre, bio). Imported podcast highlights get a placeholder window marked in `highlight.note`; set `start`/`end` after listening.

### Platform rules this prototype follows

- **YouTube**: played only through the official player, fully visible, with nothing layered over it. Previews use the player's own start/end and seek controls. No audio extraction, no hidden-player playback. YouTube items are therefore left out of Drive unless they also have a Spotify or audio source.
- **Spotify**: the official embed stays visible. Listeners not signed in to Spotify in that browser get 30-second previews; signed-in listeners get full tracks. The app reads the real duration and never claims otherwise.
- **Podcasts**: RSS enclosures are the files publishers distribute for playback in apps.
- **Where real media plays**: run locally or on a normal host. The private claude.ai artifact link blocks third-party embeds and media, so it can only run the offline demo set.

## Project structure

```
src/
  config/brand.ts         name, tagline, destination names
  data/index.ts           runtime content loader
  lib/players.ts          YouTube + Spotify adapters with one player interface
  lib/affinity.ts         points, simulated percentiles, tiers
  hooks/                  preview windows + honest listen tracking, relationships, keys, media session
  components/             MediaSurface, dial, swipe card, tier badge/ladder/reward, sheets
  screens/                YourRecord, Artists, Podcasts, FullEpisode, InnerCircle, Drive
  styles/                 tokens.css (palette), app.css, circa.css (atomic-age layer)
scripts/content/          add-youtube, import-podcast, verify, build-demo
scripts/media/            generators for the original demo media
content/demo/             generator sources for the demo set
public/content/           content sets loaded at runtime
```
