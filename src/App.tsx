import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { TabBar } from './components/Chrome'
import { CreatorSheet } from './components/CreatorSheet'
import { Splash } from './components/Logo'
import { SettingsSheet } from './components/SettingsSheet'
import { Toasts } from './components/Toasts'
import { ROUTES, type RouteId } from './config/brand'
import { Artists } from './screens/Artists'
import { Drive } from './screens/Drive'
import { FullEpisode } from './screens/FullEpisode'
import { InnerCircle } from './screens/InnerCircle'
import { Podcasts } from './screens/Podcasts'
import { YourRecord } from './screens/YourRecord'
import { useUI } from './store/useUI'

const fromHash = (): RouteId => {
  const h = window.location.hash.replace('#', '') as RouteId
  return ROUTES.includes(h) ? h : 'artists'
}

export default function App() {
  const [route, setRoute] = useState<RouteId>(fromHash)
  const [splash, setSplash] = useState(true)
  const sheet = useUI((s) => s.sheet)
  const fullEpisode = useUI((s) => s.fullEpisode)
  const drive = useUI((s) => s.drive)
  const unlockAudio = useUI((s) => s.unlockAudio)

  useEffect(() => {
    const onHash = () => setRoute(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // The first touch anywhere turns the sound on.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true, capture: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock)
    }
  }, [unlockAudio])

  const go = (r: RouteId) => {
    if (window.location.hash !== `#${r}`) window.history.replaceState(null, '', `#${r}`)
    setRoute(r)
  }

  const overlay = !!fullEpisode || drive || splash
  const isActive = (r: RouteId) => route === r && !overlay

  return (
    <div className="app" data-route={route}>
      <main className="stage">
        {(['artists', 'podcasts', 'inner-circle', 'home'] as RouteId[]).map((r) => (
          <div key={r} className="view" data-active={route === r ? '' : undefined} aria-hidden={route !== r}>
            {r === 'artists' && <Artists active={isActive('artists')} />}
            {r === 'podcasts' && <Podcasts active={isActive('podcasts')} />}
            {r === 'inner-circle' && <InnerCircle active={isActive('inner-circle')} />}
            {r === 'home' && <YourRecord active={isActive('home')} />}
          </div>
        ))}
      </main>
      <TabBar route={route} onChange={go} />

      <AnimatePresence>
        {sheet?.kind === 'creator' && <CreatorSheet key={`c-${sheet.creatorId}`} creatorId={sheet.creatorId} />}
        {sheet?.kind === 'settings' && <SettingsSheet key="settings" />}
      </AnimatePresence>
      <AnimatePresence>
        {fullEpisode && <FullEpisode key={`${fullEpisode.episodeId}-${fullEpisode.startAt}`} request={fullEpisode} />}
      </AnimatePresence>
      <AnimatePresence>{drive && <Drive key="drive" initial={route === 'podcasts' ? 'podcasts' : 'artists'} />}</AnimatePresence>
      {splash && <Splash onDone={() => setSplash(false)} />}
      <Toasts />
    </div>
  )
}
