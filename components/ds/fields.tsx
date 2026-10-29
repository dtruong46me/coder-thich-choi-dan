'use client'
import { useId, type ChangeEvent, type KeyboardEvent } from 'react'
import { cx } from './cx'
import { Icon } from './Icon'

export function TextField({
  label,
  hideLabel,
  type = 'text',
  placeholder,
  value,
  onChange,
  onKeyDown,
  error,
  hint,
  tone = 'default',
  autoComplete,
  name,
  className,
}: {
  label: string
  hideLabel?: boolean
  type?: string
  placeholder?: string
  value?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  error?: string
  hint?: string
  tone?: 'default' | 'inverse'
  autoComplete?: string
  name?: string
  className?: string
}) {
  const id = useId()
  return (
    <div className={cx('ct-field', `ct-field-${tone}`, className)}>
      <label htmlFor={id} className={cx('ct-label', hideLabel && 'ct-sr')}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="ct-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-d` : undefined}
        autoComplete={autoComplete}
      />
      {error ? (
        <span id={`${id}-d`} className="ct-field-err">
          ✗ {error}
        </span>
      ) : hint ? (
        <span id={`${id}-d`} className="ct-field-hint">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder = 'grep posts…',
  label = 'Search posts',
  shortcut,
  inputRef,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label?: string
  shortcut?: string
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const id = useId()
  return (
    <label className="ct-search" htmlFor={id}>
      <Icon name="search" size={18} />
      <span className="ct-sr">{label}</span>
      <input
        id={id}
        ref={inputRef}
        type="search"
        className="ct-search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {shortcut ? <kbd className="ct-kbd">{shortcut}</kbd> : null}
    </label>
  )
}
