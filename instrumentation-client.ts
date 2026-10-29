// Browser error reporting. The Sentry SDK (~75 KB gzip) is not part of the page: it is downloaded
// only when an error actually happens, so readers pay nothing. Off unless NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn && typeof window !== 'undefined') {
  let sentry: Promise<typeof import('@sentry/nextjs')> | null = null
  const load = () =>
    (sentry ??= import('@sentry/nextjs').then((S) => {
      S.init({ dsn, tracesSampleRate: 0 })
      return S
    }))
  window.addEventListener('error', (e) => void load().then((S) => S.captureException(e.error ?? e.message)))
  window.addEventListener('unhandledrejection', (e) => void load().then((S) => S.captureException(e.reason)))
}

export {}
