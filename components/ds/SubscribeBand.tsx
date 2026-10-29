'use client'
import { useEffect, useRef, useState } from 'react'
import { cx } from './cx'
import { TextField } from './fields'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void }
  }
}

/** Loads Cloudflare Turnstile only once someone starts typing an email. */
function useTurnstile(active: boolean) {
  const box = useRef<HTMLDivElement>(null)
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    if (!SITE_KEY || !active || !box.current) return
    const mount = () => {
      if (box.current && window.turnstile && !box.current.dataset.mounted) {
        box.current.dataset.mounted = '1'
        window.turnstile.render(box.current, { sitekey: SITE_KEY, size: 'flexible', callback: setToken })
      }
    }
    if (window.turnstile) return mount()
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = mount
    document.head.appendChild(s)
  }, [active])
  return { box, token, required: !!SITE_KEY }
}

export function SubscribeBand({
  id,
  title = 'Get new posts by email',
  description = 'One email when a public post goes live. Diary pages are never sent.',
  cta = 'Subscribe',
  topics = [],
  compact,
}: {
  id?: string
  title?: string
  description?: string
  cta?: string
  topics?: string[]
  compact?: boolean
}) {
  const [email, setEmail] = useState('')
  const [picked, setPicked] = useState<string[]>(topics)
  const [error, setError] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [honeypot, setHoneypot] = useState('')
  const { box: turnstileBox, token: turnstileToken, required: turnstileRequired } = useTurnstile(email.length > 0)

  const toggle = (t: string) => setPicked((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  async function submit() {
    const v = email.trim()
    if (!EMAIL_RE.test(v)) return setError('That email looks off. Try again?')
    if (turnstileRequired && !turnstileToken) return setError('One moment: checking you are not a bot.')
    setState('sending')
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: v, topics: picked, website: honeypot, turnstileToken: turnstileToken ?? undefined }),
    }).catch(() => null)
    if (!res || (!res.ok && res.status !== 202)) {
      setState('idle')
      setError(res?.status === 429 ? 'Too many tries. Wait a minute and try again.' : 'Could not subscribe right now. Try again later.')
      return
    }
    setState('done')
  }

  return (
    <section className={cx('ct-sub', compact && 'ct-sub-compact')} id={id}>
      <div className="ct-sub-copy">
        <h2 className="ct-sub-title">{title}</h2>
        <p className="ct-sub-desc">{description}</p>
      </div>
      <div className="ct-sub-form">
        {state === 'done' ? (
          <div className="ct-sub-done" role="status">
            &gt; subscribe --email {email.trim()}
            <br />✓ Done. Check your inbox to confirm.
          </div>
        ) : (
          <>
            {topics.length ? (
              <div className="ct-sub-topics" role="group" aria-label="Topics">
                {topics.map((t) => (
                  <button key={t} type="button" className={cx('ct-sub-topic', picked.includes(t) && 'is-on')} aria-pressed={picked.includes(t)} onClick={() => toggle(t)}>
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="ct-sub-row">
              <TextField
                label="Email address"
                tone="inverse"
                type="email"
                placeholder="you@example.com"
                value={email}
                error={error || undefined}
                autoComplete="email"
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit()
                }}
              />
              <button type="button" className="ct-sub-btn" onClick={() => void submit()} disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : cta}
              </button>
            </div>
            {/* Honeypot: hidden from people, filled in by bots. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />
            {turnstileRequired ? <div ref={turnstileBox} /> : null}
          </>
        )}
      </div>
    </section>
  )
}
