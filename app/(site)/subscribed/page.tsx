import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Button } from '@/components/ds/primitives'

export const metadata: Metadata = { title: 'Subscription', robots: { index: false } }

const COPY: Record<string, [string, string]> = {
  ok: ['You’re in.', 'One email when a new public post goes live. Diary pages are never sent.'],
  expired: ['That link has expired.', 'Confirmation links work for 48 hours. Subscribe again and use the new link.'],
  unsubscribed: ['Unsubscribed.', 'You will not get any more emails. Sorry to see you go.'],
  invalid: ['That link does not work.', 'It may be incomplete. Copy the whole link from the email.'],
}

type Props = { searchParams: Promise<{ status?: string }> }

export default function SubscribedPage({ searchParams }: Props) {
  return (
    <section className="wrap" style={{ paddingTop: 96, paddingBottom: 120, maxWidth: 640 }}>
      <Suspense fallback={null}>
        <Message searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function Message({ searchParams }: Props) {
  const status = (await searchParams).status ?? 'ok'
  const [title, body] = COPY[status] ?? COPY.invalid!
  return (
    <div className="stack-16">
      <p className="kicker-path">
        <span className="accent">~</span> $ subscribe --status {status}
      </p>
      <h1 className="h2 m0">{title}</h1>
      <p className="lead m0 muted">{body}</p>
      <div>
        <Button href="/blogs" iconRight="arrow-right">
          Read the blog
        </Button>
      </div>
    </div>
  )
}
