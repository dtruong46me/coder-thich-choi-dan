'use client'
import { cx } from './cx'

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label = 'View',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div className="ct-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cx('ct-seg-btn', o.value === value && 'is-on')}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
