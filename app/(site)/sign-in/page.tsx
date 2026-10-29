import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SignInForm } from '@/components/site/SignInForm'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } }

type Props = { searchParams: Promise<{ next?: string }> }

const safeNext = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/')

export default function SignInPage({ searchParams }: Props) {
  return (
    <section className="wrap" style={{ paddingTop: 72, paddingBottom: 96, maxWidth: 560 }}>
      <div className="stack-16">
        <p className="kicker-path">
          <span className="accent">~</span> $ login
        </p>
        <h1 className="h2 m0">Sign in</h1>
        <p className="m0 muted">
          No passwords here. Readers get a one-time link by email; the author uses a passkey.
        </p>
        <Suspense fallback={<SignInForm />}>
          <WithNext searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  )
}

async function WithNext({ searchParams }: Props) {
  const next = safeNext((await searchParams).next)
  return <SignInForm next={next} owner={next.startsWith('/admin')} />
}
