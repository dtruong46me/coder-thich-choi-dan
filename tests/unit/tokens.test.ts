import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hashToken, signUnsubscribe, unlistedToken, verifyUnsubscribe } from '@/lib/email/tokens'
import { verifyResendWebhook } from '@/lib/email/webhook'

describe('tokens', () => {
  it('unsubscribe links are signed and tamper-proof', () => {
    const t = signUnsubscribe('0190f5a2-1111-7000-8000-000000000000')
    expect(verifyUnsubscribe(t)).toBe('0190f5a2-1111-7000-8000-000000000000')
    expect(verifyUnsubscribe(t.replace('0190', '0191'))).toBeNull()
    expect(verifyUnsubscribe('garbage')).toBeNull()
  })
  it('unlisted tokens are 22 url-safe characters', () => {
    expect(unlistedToken()).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })
  it('only hashes are stored', () => {
    expect(hashToken('abc')).toHaveLength(64)
  })
})

describe('Resend webhook signature', () => {
  const secret = `whsec_${Buffer.from('test-secret').toString('base64')}`
  const sign = (id: string, ts: string, body: string) =>
    `v1,${createHmac('sha256', Buffer.from('test-secret')).update(`${id}.${ts}.${body}`).digest('base64')}`
  it('accepts a valid, fresh signature and rejects anything else', () => {
    const body = '{"type":"email.bounced"}'
    const ts = String(Math.floor(Date.now() / 1000))
    const h = (sig: string, t = ts) => new Headers({ 'svix-id': 'msg_1', 'svix-timestamp': t, 'svix-signature': sig })
    expect(verifyResendWebhook(body, h(sign('msg_1', ts, body)), secret)).toBe(true)
    expect(verifyResendWebhook(body + ' ', h(sign('msg_1', ts, body)), secret)).toBe(false)
    const old = String(Math.floor(Date.now() / 1000) - 3600)
    expect(verifyResendWebhook(body, h(sign('msg_1', old, body), old), secret)).toBe(false)
  })
})
