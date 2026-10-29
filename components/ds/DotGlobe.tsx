import { cx } from './cx'

const cache = new Map<string, { tf: string; alt: boolean; delay: string }[]>()

function dots(count: number, r: number) {
  const key = `${count}:${r}`
  let out = cache.get(key)
  if (!out) {
    out = []
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const lat = (Math.asin(y) * 180) / Math.PI
      const lon = (i * 137.508) % 360 // golden-angle spiral: even spacing on the sphere
      out.push({
        tf: `rotateY(${lon.toFixed(1)}deg) rotateX(${lat.toFixed(1)}deg) translateZ(${r}px)`,
        alt: i % 9 === 0,
        delay: `${(-(i % 12) * 0.08).toFixed(2)}s`,
      })
    }
    cache.set(key, out)
  }
  return out
}

/** CSS-only rotating dot globe. No JavaScript: the spin and pulse are keyframes in ds.css. */
export function DotGlobe({ size = 440, count = 150, playing = false }: { size?: number; count?: number; playing?: boolean }) {
  const r = Math.round(size * 0.36)
  return (
    <div
      className={cx('ct-globe-scene', playing && 'is-playing')}
      style={{ width: '100%', maxWidth: `${size}px`, aspectRatio: '1 / 1' }}
      aria-hidden="true"
    >
      <div className="ct-globe-ring" style={{ width: `${r * 2 + 12}px`, height: `${r * 2 + 12}px` }} />
      <div className="ct-globe">
        {dots(count, r).map((d, i) => (
          <span key={i} className="ct-globe-dot" style={{ transform: d.tf }}>
            <span className={cx('ct-globe-pulse', d.alt && 'is-alt')} style={{ animationDelay: d.delay }} />
          </span>
        ))}
      </div>
    </div>
  )
}
