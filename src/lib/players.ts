/**
 * A tiny common interface over every way CIRCA plays media. HTMLMediaElement
 * already satisfies it; the YouTube and Spotify adapters below implement it on
 * top of each platform's official embed API, so preview windows, honest
 * listen-tracking, auto-save and highlight→episode hand-off work the same for
 * self-hosted files, YouTube videos and Spotify tracks.
 *
 * Nothing here extracts or re-streams platform media: the official player
 * stays visible and does the playback.
 */
export interface PlayerLike {
  currentTime: number
  readonly duration: number
  readonly paused: boolean
  playbackRate: number
  muted: boolean
  readonly readyState: number
  play(): Promise<void>
  pause(): void
  addEventListener(type: string, fn: EventListener): void
  removeEventListener(type: string, fn: EventListener): void
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Could not load ${src}`))
    document.head.appendChild(s)
  })

// ------------------------------------------------------------------ YouTube

/* eslint-disable @typescript-eslint/no-explicit-any */
let ytReady: Promise<any> | null = null
function youTubeApi(): Promise<any> {
  const w = window as any
  if (w.YT?.Player) return Promise.resolve(w.YT)
  if (!ytReady) {
    ytReady = new Promise((resolve, reject) => {
      const prev = w.onYouTubeIframeAPIReady
      w.onYouTubeIframeAPIReady = () => {
        prev?.()
        resolve(w.YT)
      }
      loadScript('https://www.youtube.com/iframe_api').catch((e) => {
        ytReady = null
        reject(e)
      })
    })
  }
  return ytReady
}

/** YouTube IFrame Player API error codes, in plain words. */
export const YT_ERRORS: Record<number, string> = {
  2: 'The video ID in the content file is not valid.',
  5: 'This video cannot play in an HTML5 player.',
  100: 'This video was removed or made private.',
  101: 'The owner does not allow this video to be embedded.',
  150: 'The owner does not allow this video to be embedded.',
}

export class YouTubePlayer extends EventTarget implements PlayerLike {
  private yt: any = null
  private ready = false
  private _paused = true
  private timer = 0
  private pendingPlay: { resolve: () => void; reject: (e: Error) => void } | null = null
  private wantPlay = false
  private destroyed = false
  errorCode: number | null = null

  constructor(host: HTMLElement, videoId: string, start = 0) {
    super()
    const mount = document.createElement('div')
    host.appendChild(mount)
    youTubeApi()
      .then((YT) => {
        if (this.destroyed) return
        this.yt = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            controls: 0,
            rel: 0,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            start: Math.floor(start),
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              this.ready = true
              if (this._muted) this.yt.mute()
              this.dispatchEvent(new Event('loadedmetadata'))
              if (this.wantPlay) this.yt.playVideo()
            },
            onStateChange: (e: { data: number }) => this.onState(e.data),
            onError: (e: { data: number }) => {
              this.errorCode = e.data
              this.pendingPlay?.reject(new Error(YT_ERRORS[e.data] ?? 'Playback error'))
              this.pendingPlay = null
              this.dispatchEvent(new Event('error'))
            },
          },
        })
        const iframe = mount.tagName === 'IFRAME' ? mount : host.querySelector('iframe')
        iframe?.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture')
      })
      .catch(() => {
        this.errorCode = -1
        this.dispatchEvent(new Event('error'))
      })
  }

  private onState(s: number) {
    if (s === 1) {
      this._paused = false
      this.pendingPlay?.resolve()
      this.pendingPlay = null
      this.dispatchEvent(new Event('play'))
      window.clearInterval(this.timer)
      this.timer = window.setInterval(() => this.dispatchEvent(new Event('timeupdate')), 250)
    } else if (s === 2 || s === 0) {
      const was = this._paused
      this._paused = true
      window.clearInterval(this.timer)
      if (!was) this.dispatchEvent(new Event('pause'))
      if (s === 0) this.dispatchEvent(new Event('ended'))
    }
  }

  get currentTime() {
    return this.ready ? (this.yt.getCurrentTime?.() ?? 0) : 0
  }
  set currentTime(t: number) {
    if (this.ready) this.yt.seekTo(t, true)
  }
  get duration() {
    return this.ready ? (this.yt.getDuration?.() ?? 0) : 0
  }
  get paused() {
    return this._paused
  }
  get playbackRate() {
    return this.ready ? (this.yt.getPlaybackRate?.() ?? 1) : 1
  }
  set playbackRate(r: number) {
    if (this.ready) this.yt.setPlaybackRate(r)
  }
  get readyState() {
    return this.ready ? 4 : 0
  }
  private _muted = false
  get muted() {
    return this._muted
  }
  set muted(m: boolean) {
    this._muted = m
    if (this.ready) {
      if (m) this.yt.mute()
      else this.yt.unMute()
    }
  }

  /** Resolves once YouTube reports playback; rejects if the browser blocks it. */
  play() {
    if (this.errorCode !== null) return Promise.reject(new Error(YT_ERRORS[this.errorCode] ?? 'Unavailable'))
    this.wantPlay = true
    if (this.ready) this.yt.playVideo()
    return new Promise<void>((resolve, reject) => {
      this.pendingPlay = { resolve, reject }
      window.setTimeout(() => {
        if (this.pendingPlay && this._paused) {
          this.pendingPlay.reject(new Error('blocked'))
          this.pendingPlay = null
        }
      }, 3500)
    })
  }

  pause() {
    this.wantPlay = false
    if (this.ready && !this.destroyed) this.yt.pauseVideo()
  }

  destroy() {
    this.destroyed = true
    window.clearInterval(this.timer)
    try {
      this.yt?.destroy()
    } catch {
      /* already gone */
    }
  }
}

// ------------------------------------------------------------------ Spotify

let spReady: Promise<any> | null = null
function spotifyApi(): Promise<any> {
  const w = window as any
  if (w.__circaSpotifyApi) return Promise.resolve(w.__circaSpotifyApi)
  if (!spReady) {
    spReady = new Promise((resolve, reject) => {
      w.onSpotifyIframeApiReady = (api: any) => {
        w.__circaSpotifyApi = api
        resolve(api)
      }
      loadScript('https://open.spotify.com/embed/iframe-api/v1').catch((e) => {
        spReady = null
        reject(e)
      })
    })
  }
  return spReady
}

/**
 * Spotify's embed plays a 30-second preview for listeners who are not signed
 * in to Spotify in that browser, and the full track for those who are. The
 * reported duration tells us which, so the UI never pretends otherwise.
 */
export class SpotifyPlayer extends EventTarget implements PlayerLike {
  private ctl: any = null
  private ready = false
  private started = false
  private _paused = true
  private pos = 0
  private dur = 0
  private stamp = 0
  private destroyed = false
  errorCode: number | null = null

  constructor(host: HTMLElement, uri: string, height = 152) {
    super()
    const mount = document.createElement('div')
    host.appendChild(mount)
    spotifyApi()
      .then((api) => {
        if (this.destroyed) return
        api.createController(mount, { uri, width: '100%', height }, (ctl: any) => {
          this.ctl = ctl
          ctl.addListener('ready', () => {
            this.ready = true
            this.dispatchEvent(new Event('loadedmetadata'))
          })
          ctl.addListener('playback_update', (e: { data: { isPaused: boolean; position: number; duration: number } }) => {
            const { isPaused, position, duration } = e.data
            this.pos = position / 1000
            this.dur = duration / 1000
            this.stamp = performance.now()
            if (isPaused !== this._paused) {
              this._paused = isPaused
              this.dispatchEvent(new Event(isPaused ? 'pause' : 'play'))
            }
            this.dispatchEvent(new Event('timeupdate'))
            if (isPaused && this.dur > 0 && this.pos >= this.dur - 0.3) this.dispatchEvent(new Event('ended'))
          })
        })
      })
      .catch(() => {
        this.errorCode = -1
        this.dispatchEvent(new Event('error'))
      })
  }

  get currentTime() {
    // interpolate between Spotify's (roughly half-second) updates
    return this._paused ? this.pos : Math.min(this.dur || Infinity, this.pos + (performance.now() - this.stamp) / 1000)
  }
  set currentTime(t: number) {
    if (this.ready) this.ctl.seek(Math.max(0, t))
    this.pos = t
  }
  get duration() {
    return this.dur
  }
  get paused() {
    return this._paused
  }
  get playbackRate() {
    return 1
  }
  get muted() {
    return false
  }
  set muted(_m: boolean) {
    /* the Spotify embed controls its own volume */
  }
  set playbackRate(_r: number) {
    /* the Spotify embed has no speed control */
  }
  get readyState() {
    return this.ready ? 4 : 0
  }
  play() {
    if (!this.ready) return Promise.reject(new Error('not ready'))
    if (this.started) this.ctl.resume()
    else {
      this.ctl.play()
      this.started = true
    }
    return Promise.resolve()
  }
  pause() {
    if (this.ready && !this.destroyed) this.ctl.pause()
  }
  destroy() {
    this.destroyed = true
    try {
      this.ctl?.destroy()
    } catch {
      /* already gone */
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
