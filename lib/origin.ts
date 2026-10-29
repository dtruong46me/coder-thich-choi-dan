import 'server-only'
import { SITE } from './site'

/** CSRF guard for our own JSON routes: the browser's Origin must be this site. Server actions do this already. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  try {
    const allowed = new Set([new URL(SITE.url).origin, new URL(req.url).origin])
    return allowed.has(new URL(origin).origin)
  } catch {
    return false
  }
}
