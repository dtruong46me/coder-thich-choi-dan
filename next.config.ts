import type { NextConfig } from 'next'

const r2Host = process.env.R2_PUBLIC_HOST // e.g. media.coderthichchoidan.dev

// Public pages are prerendered and served from the CDN, so they cannot carry a per-request nonce.
// They get a static policy here; /admin gets a nonce-based policy from proxy.ts.
const publicCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${r2Host ? ` https://${r2Host}` : ''}`,
  "font-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  'frame-src https://www.youtube-nocookie.com https://challenges.cloudflare.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: false,
  poweredByHeader: false,
  serverExternalPackages: ['shiki'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: r2Host ? [{ protocol: 'https', hostname: r2Host }] : [],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/((?!admin|api|_next/static|_next/image|favicon.ico).*)',
        headers: [{ key: 'Content-Security-Policy', value: publicCsp }],
      },
    ]
  },
}

export default nextConfig
