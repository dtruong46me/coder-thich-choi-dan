import { Suspense } from 'react'
import { PostsTable } from '@/components/admin/PostsTable'
import { requireOwnerPage } from '@/lib/access'
import { getAdminPosts } from '@/lib/db/queries/admin'
import { getCollections } from '@/lib/db/queries/public'

type Props = { searchParams: Promise<{ tab?: string }> }

export default function PostsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Posts searchParams={searchParams} />
    </Suspense>
  )
}

async function Posts({ searchParams }: Props) {
  const owner = await requireOwnerPage()
  const [{ tab }, rows, collections] = await Promise.all([searchParams, getAdminPosts(owner.userId), getCollections()])
  return (
    <PostsTable
      key={tab ?? 'all'}
      initialTab={tab ?? 'all'}
      collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      rows={rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        status: r.status,
        visibility: r.visibility,
        collection: r.collection,
        tags: r.tags,
        views: r.views,
        sharedCount: r.sharedCount,
        updatedAt: r.updatedAt.toISOString(),
        scheduledAt: r.scheduledAt?.toISOString() ?? null,
      }))}
    />
  )
}
