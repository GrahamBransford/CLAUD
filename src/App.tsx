import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { BottomNav, Header } from './components/Chrome'
import { LibrarySheet } from './components/LibrarySheet'
import { ProfileSheet } from './components/ProfileSheet'
import { Toasts } from './components/Toasts'
import { TuningSheet } from './components/TuningSheet'
import { Welcome } from './components/Welcome'
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
  return ROUTES.includes(h) ? h : 'home'
}

const WELCOMED = 'circa-welcomed'

export default function App() {
  const [route, setRoute] = useState<RouteId>(fromHash)
  const sheet = useUI((s) => s.sheet)
  const fullEpisode = useUI((s) => s.fullEpisode)
  const drive = useUI((s) => s.drive)
  const unlockAudio = useUI((s) => s.unlockAudio)
  const [welcome, setWelcome] = useState(() => {
    try {
      return sessionStorage.getItem(WELCOMED) !== '1'
    } catch {
      return true
    }
  })

  useEffect(() => {
    const onHash = () => setRoute(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Any first interaction counts as permission to play sound.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [unlockAudio])

  const go = (r: RouteId) => {
    if (window.location.hash !== `#${r}`) window.location.hash = r
    setRoute(r)
    window.scrollTo({ top: 0 })
  }

  const overlay = !!fullEpisode || drive
  const isActive = (r: RouteId) => route === r && !overlay && !welcome

  return (
    <div className={`app app--${route}`} data-overlay={overlay ? '' : undefined}>
      <Header route={route} onChange={go} />
      <main className="stage">
        <div className="station-view station-view--home" hidden={route !== 'home'}>
          <YourRecord active={isActive('home')} />
        </div>
        <div className="station-view" hidden={route !== 'artists'}>
          <Artists active={isActive('artists')} />
        </div>
        <div className="station-view" hidden={route !== 'podcasts'}>
          <Podcasts active={isActive('podcasts')} />
        </div>
        <div className="station-view station-view--ic" hidden={route !== 'inner-circle'}>
          <InnerCircle active={isActive('inner-circle')} />
        </div>
      </main>
      <BottomNav route={route} onChange={go} />

      <AnimatePresence>
        {sheet?.kind === 'library' && <LibrarySheet key="library" />}
        {sheet?.kind === 'profile' && <ProfileSheet key={`p-${sheet.creatorId}`} creatorId={sheet.creatorId} />}
        {sheet?.kind === 'tuning' && <TuningSheet key="tuning" />}
      </AnimatePresence>
      <AnimatePresence>
        {fullEpisode && <FullEpisode key={`${fullEpisode.episodeId}-${fullEpisode.startAt}`} request={fullEpisode} />}
      </AnimatePresence>
      <AnimatePresence>
        {drive && <Drive key="drive" initial={route === 'podcasts' ? 'podcasts' : route === 'home' ? 'record' : 'artists'} />}
      </AnimatePresence>
      <AnimatePresence>
        {welcome && (
          <Welcome
            key="welcome"
            onTuneIn={() => {
              unlockAudio()
              try {
                sessionStorage.setItem(WELCOMED, '1')
              } catch {
                /* private mode: the splash simply shows again next visit */
              }
              setWelcome(false)
              go('home')
            }}
          />
        )}
      </AnimatePresence>
      <Toasts />
    </div>
  )
}
