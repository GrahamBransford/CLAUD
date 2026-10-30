import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import './styles/tokens.css'
import './styles/app.css'
import './styles/circa.css'
import { activeSet, loadContent } from './data'
import { initStore } from './store/useStore'

const root = createRoot(document.getElementById('root')!)

// Content comes from public/content/*.json at runtime, so it can change without a rebuild.
loadContent()
  .then(async () => {
    initStore(activeSet)
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
