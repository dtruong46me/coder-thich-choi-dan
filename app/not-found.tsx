import Link from 'next/link'

// Plain server markup: no client code, so this page also serves as the "runtime only" JS baseline.
export default function NotFound() {
  return (
    <main className="wrap" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, maxWidth: 640 }}>
      <p className="kicker-path">
        <span className="accent">~</span> $ cat page.md
      </p>
      <h1 className="h1 m0">404. This page is not here.</h1>
      <p className="lead m0 muted">It may have moved, or it may be a private page you need to sign in for.</p>
      <p className="m0">
        <Link href="/" className="ct-btn ct-btn-primary ct-btn-md">
          <span>Back home</span>
        </Link>
      </p>
    </main>
  )
}
