import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifies a Resend webhook (Svix format): HMAC-SHA256 over "<id>.<timestamp>.<body>",
 * base64, with the secret after "whsec_". Rejects anything older than 5 minutes.
 */
export function verifyResendWebhook(body: string, headers: Headers, secret = process.env.RESEND_WEBHOOK_SECRET): boolean {
  const id = headers.get('svix-id')
  const ts = headers.get('svix-timestamp')
  const sigHeader = headers.get('svix-signature')
  if (!secret || !id || !ts || !sigHeader) return false
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(age) || age > 300) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest()
  return sigHeader.split(' ').some((part) => {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) return false
    const got = Buffer.from(sig, 'base64')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}
