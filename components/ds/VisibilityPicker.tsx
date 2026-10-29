'use client'
import { useId, useState } from 'react'
import type { Visibility } from '@/lib/db/schema'
import { cx } from './cx'
import { TextField } from './fields'
import { Icon } from './Icon'
import { Button, VISIBILITY } from './primitives'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function VisibilityPicker({
  value,
  onChange,
  sharedWith,
  onAdd,
  onRemove,
  legend = 'Who can read this?',
  disabled,
}: {
  value: Visibility
  onChange: (v: Visibility) => void
  sharedWith: { id: string; email: string }[]
  onAdd: (email: string) => void
  onRemove: (id: string) => void
  legend?: string
  disabled?: boolean
}) {
  const name = useId()
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim().toLowerCase()
    if (!EMAIL_RE.test(v) || sharedWith.some((p) => p.email === v)) return
    onAdd(v)
    setDraft('')
  }
  return (
    <fieldset className="ct-vispick" disabled={disabled}>
      <legend className="ct-vispick-legend">{legend}</legend>
      {(Object.keys(VISIBILITY) as Visibility[]).map((m) => (
        <label key={m} className={cx('ct-vis-opt', m === value && 'is-on')}>
          <input type="radio" name={name} value={m} checked={m === value} onChange={() => onChange(m)} />
          <span className="ct-vis-ico">
            <Icon name={VISIBILITY[m].icon} size={17} />
          </span>
          <span className="ct-vis-txt">
            <span className="ct-vis-name">{VISIBILITY[m].label}</span>
            <span className="ct-vis-desc">{VISIBILITY[m].desc}</span>
          </span>
        </label>
      ))}
      {value === 'shared' ? (
        <div className="ct-vis-share">
          <div className="ct-vis-people">
            {sharedWith.map((p) => (
              <span key={p.id} className="ct-person">
                {p.email}
                <button type="button" className="ct-person-x" aria-label={`Remove ${p.email}`} onClick={() => onRemove(p.id)}>
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="ct-vis-add">
            <TextField
              label="Add an account by email"
              hideLabel
              type="email"
              placeholder="friend@example.com"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
            />
            <Button variant="ghost" size="sm" onClick={add}>
              Add
            </Button>
          </div>
        </div>
      ) : null}
    </fieldset>
  )
}
