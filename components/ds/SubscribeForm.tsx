'use client'
import { useEffect, useId, useRef, useState } from 'react'

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

/** A small email signup tucked into the footer. It subscribes to every new public post. */
export function SubscribeForm({ id }: { id?: string }) {
  const inputId = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [honeypot, setHoneypot] = useState('')
  const { box: turnstileBox, token: turnstileToken, required: turnstileRequired } = useTurnstile(email.length > 0)

  async function submit() {
    const v = email.trim()
    if (!EMAIL_RE.test(v)) return setError('That email looks off. Try again?')
    if (turnstileRequired && !turnstileToken) return setError('One moment: checking you are not a bot.')
    setState('sending')
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: v, website: honeypot, turnstileToken: turnstileToken ?? undefined }),
    }).catch(() => null)
    if (!res || (!res.ok && res.status !== 202)) {
      setState('idle')
      setError(res?.status === 429 ? 'Too many tries. Wait a minute and try again.' : 'Could not subscribe right now. Try again later.')
      return
    }
    setState('done')
  }

  return (
    <form
      className="ct-sub"
      id={id}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label htmlFor={inputId} className="ct-sub-label">
        New posts by email
      </label>
      {state === 'done' ? (
        <p className="ct-sub-done" role="status">
          ✓ Check your inbox to confirm.
        </p>
      ) : (
        <>
          <div className="ct-sub-row">
            <input
              id={inputId}
              type="email"
              className="ct-sub-input"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-err` : undefined}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
            />
            <button type="submit" className="ct-sub-btn" disabled={state === 'sending'}>
              {state === 'sending' ? '…' : 'Subscribe'}
            </button>
          </div>
          {error ? (
            <p id={`${inputId}-err`} className="ct-sub-err">
              {error}
            </p>
          ) : null}
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
    </form>
  )
}
