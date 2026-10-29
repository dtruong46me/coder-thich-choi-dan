import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const secret = () => process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me'

/** A random URL-safe token. Only its hash is stored. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** 22-character token for /u/<token> unlisted links. */
export const unlistedToken = () => randomBytes(16).toString('base64url').slice(0, 22)

/**
 * Unsubscribe tokens are signed, not stored: `<subscriberId>.<hmac>`.
 * They never expire, so a one-click unsubscribe link in an old email keeps working.
 */
export function signUnsubscribe(subscriberId: string): string {
  const mac = createHmac('sha256', secret()).update(`unsub:${subscriberId}`).digest('base64url')
  return `${subscriberId}.${mac}`
}

export function verifyUnsubscribe(token: string): string | null {
  const [id, mac] = token.split('.')
  if (!id || !mac) return null
  const expected = createHmac('sha256', secret()).update(`unsub:${id}`).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b) ? id : null
}
