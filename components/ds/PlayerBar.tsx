'use client'
import { cx } from './cx'
import { Icon } from './Icon'
import { IconButton } from './primitives'

export function PlayerBar({
  title,
  chords,
  active,
  playing,
  status,
  onToggle,
  onNext,
}: {
  title: string
  chords: string[]
  active: number
  playing: boolean
  status?: string
  onToggle: () => void
  onNext?: () => void
}) {
  return (
    <div className="ct-player">
      <button type="button" className="ct-player-play" aria-label={playing ? 'Pause' : 'Play'} onClick={onToggle}>
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </button>
      <div className="ct-player-info">
        <span className="ct-player-status">{status ?? (playing ? 'NOW PLAYING' : 'PAUSED · PRESS PLAY')}</span>
        <span className="ct-player-title">{title}</span>
        {chords.length ? (
          <span className="ct-player-chords">
            {chords.map((c, i) => (
              <span key={i} className={cx('ct-chord', playing && i === active && 'is-on')}>
                {c}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      {onNext ? <IconButton icon="skip" label="Next loop" onClick={onNext} /> : null}
    </div>
  )
}
