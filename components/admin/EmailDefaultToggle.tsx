'use client'
import { useState, useTransition } from 'react'
import { updateSettings } from '@/lib/actions/manage'

export function EmailDefaultToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <label className="toggle-row">
      <span className="stack-8" style={{ gap: 0 }}>
        <span style={{ fontWeight: 500 }}>Email subscribers on publish</span>
        <span className="small muted">Public posts only. Diary entries are never sent.</span>
      </span>
      <input
        type="checkbox"
        className="check"
        style={{ width: 20, height: 20 }}
        checked={on}
        disabled={pending}
        onChange={() => {
          const next = !on
          setOn(next)
          start(async () => {
            const res = await updateSettings({ emailOnPublishDefault: next })
            if (!res.ok) setOn(!next)
          })
        }}
      />
    </label>
  )
}
