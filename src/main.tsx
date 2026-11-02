import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import './styles/tokens.css'
import './styles/app.css'
import { activeSet, loadContent } from './data'
import { initStore } from './store/useStore'
import { installHaptics } from './lib/haptics'
import { installViewportFill } from './lib/viewport'

installViewportFill()

// A picture that can't load (a blocked image host, a moved channel photo) becomes a
// quiet record label instead of a broken-image icon.
const BLANK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#13241b"/><circle cx="20" cy="20" r="13" fill="none" stroke="#b4955e" stroke-opacity=".45"/><circle cx="20" cy="20" r="2.4" fill="#b4955e" fill-opacity=".6"/></svg>')}`
document.addEventListener(
  'error',
  (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement) || img.src === BLANK) return
    // atmosphere (posters, blurred backdrops) simply steps aside; faces get the label
    if (img.matches('.embed__poster, .reel__backdrop, .moment__backdrop')) img.style.visibility = 'hidden'
    else img.src = BLANK
  },
  true,
)

const root = createRoot(document.getElementById('root')!)

// Content comes from public/content/*.json at runtime, so it can change without a rebuild.
loadContent()
  .then(async () => {
    initStore(activeSet)
    installHaptics()
    const { default: App } = await import('./App.tsx')
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((e: Error) => {
    root.render(
      <div className="boot-error">
        <h1>CIRCA couldn&rsquo;t load its content.</h1>
        <p>{e.message}</p>
        <p>Check that public/content/index.json and the content file it points to are valid JSON.</p>
      </div>,
    )
  })
