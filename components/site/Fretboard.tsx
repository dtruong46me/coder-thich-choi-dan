// Decorative fretboard: frets placed with the real equal-temperament formula d(n) = 1 - 2^(-n/12).
const pos = (n: number) => (1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -15 / 12))
const pct = (x: number) => `${(x * 100).toFixed(2)}%`
const FRETS = Array.from({ length: 15 }, (_, i) => pct(pos(i + 1)))
const mid = (n: number) => pct((pos(n) + pos(n - 1)) / 2)
const INLAYS = [
  ...[3, 5, 7, 9, 15].map((n) => ({ left: mid(n), top: '50%' })),
  { left: mid(12), top: '30%' },
  { left: mid(12), top: '70%' },
]
const STRINGS = [0, 1, 2, 3, 4, 5].map((s) => ({ top: `${s * 20}%`, h: `${(1 + (5 - s) * 0.5).toFixed(1)}px` }))

export function Fretboard() {
  return (
    <div className="fretboard" aria-hidden="true">
      <div className="fretboard-neck">
        {STRINGS.map((s, i) => (
          <div key={`s${i}`} className="fb-string" style={{ top: s.top, height: s.h }} />
        ))}
        {FRETS.map((left, i) => (
          <div key={`f${i}`} className="fb-fret" style={{ left }} />
        ))}
        {INLAYS.map((d, i) => (
          <div key={`i${i}`} className="fb-inlay" style={{ left: d.left, top: d.top }} />
        ))}
      </div>
    </div>
  )
}
