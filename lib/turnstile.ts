import 'server-only'

/** Cloudflare Turnstile check. Skipped (returns true) when no secret is configured, e.g. in local dev. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  const body = new URLSearchParams({ secret, response: token, remoteip: ip })
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body }).catch(() => null)
  if (!res?.ok) return false
  const data = (await res.json()) as { success?: boolean }
  return data.success === true
}
