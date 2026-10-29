'use client'
import { useState } from 'react'
import { TextField } from '@/components/ds/fields'
import { Button } from '@/components/ds/primitives'
import { authClient } from '@/lib/auth-client'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Readers: a magic link by email. The owner: passkey, with GitHub as the fallback. */
export function SignInForm({ next = '/', owner = false }: { next?: string; owner?: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function sendLink() {
    const v = email.trim()
    if (!EMAIL_RE.test(v)) return setError('That email looks off.')
    setState('sending')
    const { error: err } = await authClient.signIn.magicLink({ email: v, callbackURL: next })
    if (err) {
      setState('idle')
      return setError(err.message ?? 'Could not send the link. Try again in a minute.')
    }
    setState('sent')
  }

  async function passkey() {
    setError('')
    const res = await authClient.signIn.passkey()
    if (res?.error) return setError(res.error.message ?? 'Passkey sign-in failed.')
    window.location.assign(next)
  }

  if (state === 'sent')
    return (
      <div className="notice" role="status">
        Check your inbox: a sign-in link is on its way to <strong>{email.trim()}</strong>. It works once and expires in 15 minutes.
      </div>
    )

  return (
    <div className="stack-12">
      {owner ? (
        <div className="row-8">
          <Button icon="lock" onClick={() => void passkey()}>
            Sign in with a passkey
          </Button>
          <Button variant="ghost" icon="github" onClick={() => void authClient.signIn.social({ provider: 'github', callbackURL: next })}>
            GitHub
          </Button>
        </div>
      ) : null}
      <div className="row-8" style={{ alignItems: 'flex-end' }}>
        <TextField
          label={owner ? 'Or get a link by email' : 'Email'}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          error={error || undefined}
          onChange={(e) => {
            setEmail(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void sendLink()
          }}
          className="grow"
        />
        <Button variant={owner ? 'ghost' : 'primary'} onClick={() => void sendLink()} disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Email me a link'}
        </Button>
      </div>
      {error && owner ? <p className="small m0" style={{ color: 'var(--danger)' }}>{error}</p> : null}
    </div>
  )
}
