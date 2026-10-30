# CIRCA — creative discovery prototype

A working prototype of a new kind of radio: swipe-to-discover music, five-minute podcast highlights that roll into full episodes, and a feed of raw, behind-the-scenes moments from the creators you follow.

> The product name, **CIRCA** (as in *circa 1940*), lives in one place — `src/config/brand.ts` — and the wordmark, page title, welcome screen and copy all follow it.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build (static files, no server needed):

```bash
npm run build      # outputs dist/
npm run preview    # serves dist/ at http://localhost:4173
```

Requires Node 20+. Everything — media included — is local, so the demo works offline.

## The three stations

| Station | What it is | What to show |
| --- | --- | --- |
| **Singers** (88.1) | Music discovery. Each card is the song's music video; you get a 60–90 s preview window of a ~2 min track. | Swipe right to keep, left to pass (or the ♥ / ✕ buttons, or ← / → keys). **Listen to the end and it's saved automatically.** |
| **Speakers** (94.5) | Podcast discovery. A hand-picked ~5 min highlight cut from the *middle* of a 9–11 min episode, with a live transcript. | "Watch full episode" picks up at the exact moment you were at. **Finish the highlight and the full episode starts by itself**, right after the highlight. |
| **Handhelds** (101.9) | Phone-shot, unpolished clips — only from creators you follow, ordered by how much of their work you actually listen to. | Follow / unfollow someone and watch the feed change. "How this is ordered" shows the live scoring. |

Also: **Collection** (top right) holds kept songs and episodes, and **Drive** (top right) is the simulated CarPlay / Android Auto view.

## A five-minute pitch walkthrough

1. Open the app → **Tune in**. The first music video starts.
2. Swipe one song right (toast: *Saved to your collection*), swipe one left.
3. Let a song play to the end — *"Saved — you listened all the way through"* — then it moves to the next song by itself.
4. **Speakers** → let the highlight play for a moment, press **Watch full episode**. Point out the ochre band on the dial: that's where the highlight came from. Go **Back to discovery**.
5. **Handhelds** → tap a clip (sound on). Open **How this is ordered**. Follow someone from *Not in your circle yet*; their clips appear, ranked by listening.
6. **Drive** → video gives way to still artwork and large controls; audio keeps playing and auto-save keeps working.
7. **Collection** → saved items, which were saved by listening vs. by swipe, the simulated streaming destination, and **Reset demo data** for the next run.

Keyboard (desktop): `←` pass · `→` keep · `space` play/pause · `R` replay · `F` full episode (Speakers) · `Esc` closes panels.

## What is real and what is simulated

**Works for real in the prototype**
- Audio/video playback, progress, seeking, replay, previous/next, preview windows.
- Swipe and button skip/save, auto-save after genuinely listening to ≥ 85 % of a preview (scrubbing to the end doesn't count).
- Highlight → full-episode handoff (manual and automatic), chapters, transcripts, resume position.
- Follow/unfollow, follow-gated Handhelds feed, affinity ranking that responds to your listening and saves.
- Collection with inline preview playback; everything persists in `localStorage` across refreshes.
- Drive mode: audio-only playback with still artwork, auto-save and auto-progression.
- System media controls (Media Session API): lock screen, Bluetooth headset and car steering-wheel play / pause / next work in every station, including Drive.

**Simulated (and labelled as such in the UI)**
- **Streaming services.** "Spotify (demo)" / "Apple Music (demo)" only show where a saved song *would* be filed. Nothing is sent anywhere. The seam is `src/lib/streaming.ts`.
- **Listening history.** Handhelds ranking starts from a small simulated history (`listeningSeed` in `src/data/catalog.json`) standing in for connected streaming data; in-app listening is added on top. The scoring lives in `src/lib/affinity.ts`.
- **CarPlay / Android Auto.** Drive is an in-app view, not a certified integration.
- **Highlight extraction.** Highlights are hand-marked in the scripts, not produced by AI.

## About the demo content

All artists, shows, people and media are **original and fictional**, generated for this prototype (no third-party music or footage):

- **Songs** — six original instrumental compositions synthesized in code (`scripts/media/songs.py`), each with a generative, beat-synced music video.
- **Podcasts** — four written episodes voiced with a local neural text-to-speech model (Piper, LibriTTS voices, CC BY 4.0), with an illustrated "studio" video animated from who is speaking.
- **Handhelds** — procedurally rendered phone-style clips with synthesized or TTS audio, plus two generated photos.

Because these are stand-ins, the episodes are 9–11 minutes rather than a typical 30–90, and the voices are synthetic. Swapping in real content is a data change, not a code change (below).

## Adding real content

- Editorial metadata (names, bios, titles, captions, follows) lives in `src/data/catalog.json`.
- Media facts (file paths, durations, preview end, highlight range, chapters, transcript cues) live in `src/data/media.json`. Paths are relative to `public/`.
- Drop real files into `public/media/…`, update both JSON files, done. A music video can be any length; the preview window is `preview.start` → `previewEnd`.

To regenerate all the demo media from source, see `scripts/media/build_all.sh` (Python 3 with numpy/scipy/pillow/piper-tts, plus ffmpeg; ~40 minutes on 4 cores).

## Project structure

```
src/
  config/brand.ts         product name, tagline, station names
  data/                   catalog.json (editorial) + media.json (generated) + typed accessors
  store/                  zustand stores: persisted (saves, follows, listening) and UI
  hooks/                  useWindowedPlayback (preview windows + honest listen tracking), useKeys
  lib/                    affinity ranking, streaming-service seam, media helpers
  components/             dial progress, swipe card, sheets, toasts, header/nav
  screens/                Singers, Speakers, FullEpisode, Handhelds, Drive
  styles/                 design tokens + stylesheet
scripts/media/            generators for all demo audio, video and artwork
content/podcasts/         the podcast scripts (with highlight markers)
public/media/             generated media served to the app
```
