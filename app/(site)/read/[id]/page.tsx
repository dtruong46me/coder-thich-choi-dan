import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Button, VisibilityBadge } from '@/components/ds/primitives'
import { SignInForm } from '@/components/site/SignInForm'
import { getViewer } from '@/lib/access'
import { getLockedStub, getReadableSlug } from '@/lib/db/queries/viewer'
import type { Visibility } from '@/lib/db/schema'
import { formatDate } from '@/lib/format'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Locked', robots: { index: false, follow: false } }

const WHY: Record<string, string> = {
  members: 'This one is for subscribers. Sign in with the email you subscribed with.',
  shared: 'This page is shared with a few people. If that is you, sign in with the email it was shared to.',
  private: 'This is a private diary page. Only the author can read it.',
}

/** Where locked cards point. Signed-in readers with access are sent on to the post. */
export default function ReadPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="wrap" style={{ paddingTop: 48 }} aria-busy="true" />}>
      <Resolve params={params} />
    </Suspense>
  )
}

async function Resolve({ params }: Props) {
  const { id } = await params
  const viewer = await getViewer()
  const slug = await getReadableSlug(viewer, id)
  if (slug) redirect(`/blogs/${slug}`)
  const stub = await getLockedStub(id)
  if (!stub) notFound()
  const vis = stub.visibility as Visibility
  return (
    <section className="wrap" style={{ paddingTop: 72, paddingBottom: 96, maxWidth: 640 }}>
      <div className="stack-16">
        <span className="row-8">
          <VisibilityBadge mode={vis} />
          <span className="small muted">
            {stub.collection} · {formatDate(stub.publishedAt)}
          </span>
        </span>
        <h1 className="h2 m0 row-12">
          <Icon name="lock" size={28} /> Locked
        </h1>
        <p className="lead m0 muted">{WHY[vis] ?? 'You do not have access to this page.'}</p>
        {vis !== 'private' && viewer.kind === 'anon' ? <SignInForm next={`/read/${id}`} /> : null}
        {viewer.kind === 'reader' ? (
          <p className="m0 muted">
            You are signed in as <strong>{viewer.email}</strong>, which does not have access. Ask me if you think it should.
          </p>
        ) : null}
        <div>
          <Button variant="ghost" href="/blogs" icon="arrow-left">
            Back to the blog
          </Button>
        </div>
      </div>
    </section>
  )
}
