import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'
import { THEME_SCRIPT_HASH } from './app/theme-script'

/**
 * First gate for /admin: no session cookie, no admin. This is only an optimistic check;
 * every admin page and server action calls requireOwner() itself.
 * Admin pages are dynamic anyway, so they also get a strict nonce-based Content-Security-Policy.
 */
export function proxy(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const url = new URL('/sign-in', req.url)
    url.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const r2 = process.env.R2_PUBLIC_HOST ? ` https://${process.env.R2_PUBLIC_HOST}` : ''
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${THEME_SCRIPT_HASH}${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${r2}`,
    "font-src 'self' data:",
    `connect-src 'self' https://*.r2.cloudflarestorage.com`,
    'frame-src https://www.youtube-nocookie.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  const headers = new Headers(req.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)
  const res = NextResponse.next({ request: { headers } })
  res.headers.set('content-security-policy', csp)
  res.headers.set('cache-control', 'private, no-store')
  return res
}

export const config = {
  matcher: ['/admin/:path*'],
}
