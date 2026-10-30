import { brand } from '../config/brand'

/**
 * The CIRCA wordmark: expanded grotesque capitals, and a single dot set in
 * orbit after the name — the listener, travelling toward the centre.
 */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' | 'xl' }) {
  return (
    <span className={`wordmark wordmark--${size}`} aria-label={brand.name}>
      <span aria-hidden>{brand.name}</span>
      <span className="wordmark__orbit" aria-hidden>
        <i />
      </span>
    </span>
  )
}
