import * as Sentry from '@sentry/nextjs'

// Server-side error reporting. Does nothing until SENTRY_DSN is set. Sentry sends no PII by default (no IPs, cookies or emails).
export function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}

export const onRequestError = Sentry.captureRequestError
