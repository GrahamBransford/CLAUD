import { motion } from 'framer-motion'
import { brand } from '../config/brand'
import { Wordmark } from './Wordmark'

export function Welcome({ onTuneIn }: { onTuneIn: () => void }) {
  return (
    <motion.div className="welcome" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
      <div className="welcome__inner">
        <div className="welcome__scale" aria-hidden>
          {Array.from({ length: 41 }, (_, i) => (
            <span key={i} className={i % 10 === 0 ? 'is-major' : i % 5 === 0 ? 'is-mid' : ''} />
          ))}
          <i />
        </div>
        <Wordmark size="xl" />
        <p className="welcome__tagline">{brand.tagline}</p>
        <p className="welcome__promise">{brand.promise}</p>
        <ul className="welcome__stations">
          {Object.values(brand.stations).map((s) => (
            <li key={s.label}>
              <span>{s.frequency}</span>
              <strong>{s.label}</strong>
              <em>{s.kicker}</em>
            </li>
          ))}
        </ul>
        <button className="btn btn--accent btn--xl" onClick={onTuneIn} autoFocus>
          Tune in
        </button>
        <p className="welcome__fine">Prototype · all artists, shows and media are original demo content</p>
      </div>
    </motion.div>
  )
}
