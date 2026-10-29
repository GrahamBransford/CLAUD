import { brand } from '../config/brand'

/**
 * Wordmark built from the configured name. The first lowercase "i" gets a
 * tuning-dot in brand red; names without one get the dot as a full stop.
 */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' | 'xl' }) {
  const name = brand.name
  const i = name.indexOf('i')
  return (
    <span className={`wordmark wordmark--${size}${name === name.toUpperCase() ? ' wordmark--caps' : ''}`} aria-label={name}>
      {i >= 0 ? (
        <>
          {name.slice(0, i)}
          <span className="wordmark__i" aria-hidden>
            ı<b />
          </span>
          {name.slice(i + 1)}
        </>
      ) : (
        <>
          {name}
          <span className="wordmark__stop" aria-hidden />
        </>
      )}
    </span>
  )
}
