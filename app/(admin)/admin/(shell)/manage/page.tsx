import { and, desc, eq, isNull } from 'drizzle-orm'
import { Suspense } from 'react'
import { ManageTabs } from '@/components/admin/ManageTabs'
import { requireOwnerPage } from '@/lib/access'
import { withScope } from '@/lib/db/client'
import { getManageData } from '@/lib/db/queries/admin'
import { posts } from '@/lib/db/schema'

type Props = { searchParams: Promise<{ tab?: string }> }

export default function ManagePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Manage searchParams={searchParams} />
    </Suspense>
  )
}

async function Manage({ searchParams }: Props) {
  const owner = await requireOwnerPage()
  const [{ tab }, data, shareable] = await Promise.all([
    searchParams,
    getManageData(owner.userId),
    withScope({ role: 'owner', userId: owner.userId }, (tx) =>
      tx
        .select({ id: posts.id, title: posts.title, kind: posts.kind })
        .from(posts)
        .where(and(isNull(posts.deletedAt), eq(posts.visibility, 'shared')))
        .orderBy(desc(posts.updatedAt))
        .limit(100),
    ),
  ])
  return (
    <ManageTabs
      key={tab ?? 'collections'}
      initialTab={tab ?? 'collections'}
      collections={data.collections.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, defaultVisibility: c.defaultVisibility, count: c.count }))}
      projects={data.projects.map((p) => ({ ...p, postId: p.postId ?? null }))}
      subscribers={data.subscribers.map((s) => ({ id: s.id, masked: s.masked, status: s.status, topics: s.topics, createdAt: s.createdAt.toISOString() }))}
      subscriberStats={data.subscriberStats}
      grants={data.grants.map((g) => ({ id: g.id, email: g.email, scope: g.scope, postTitle: g.postTitle, createdAt: g.createdAt.toISOString() }))}
      shareable={shareable}
      settings={data.settings}
      mailConnected={!!process.env.RESEND_API_KEY}
    />
  )
}
