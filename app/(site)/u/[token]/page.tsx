import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PostView } from '@/components/site/PostView'
import { getUnlistedPost } from '@/lib/db/queries/public'

type Props = { params: Promise<{ token: string }> }

// Unlisted: anyone with the link, never listed, never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function UnlistedPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="wrap" style={{ paddingTop: 48 }} aria-busy="true" />}>
      <Resolve params={params} />
    </Suspense>
  )
}

async function Resolve({ params }: Props) {
  const { token } = await params
  const post = await getUnlistedPost(token)
  if (!post) notFound()
  return <PostView post={post} />
}
