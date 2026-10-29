import 'katex/dist/katex.min.css'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Editor } from '@/components/editor/Editor'
import { requireOwnerPage } from '@/lib/access'
import { getEditorData } from '@/lib/db/queries/admin'
import { SITE } from '@/lib/site'

type Props = { params: Promise<{ id: string }> }

export default function EditorPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Opening the editor…</p>}>
      <Load params={params} />
    </Suspense>
  )
}

async function Load({ params }: Props) {
  const owner = await requireOwnerPage()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const data = await getEditorData(owner.userId, id)
  if (!data) notFound()
  const p = data.post
  return (
    <Editor
      key={p.id}
      data={{
        post: {
          id: p.id,
          kind: p.kind,
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          collectionId: p.collectionId,
          status: p.status,
          visibility: p.visibility,
          draftJson: p.draftJson as { type: 'doc' },
          draftVersion: p.draftVersion,
          publishedAt: p.publishedAt?.toISOString() ?? null,
          scheduledAt: p.scheduledAt?.toISOString() ?? null,
          unlistedToken: p.unlistedToken,
          notifyOnPublish: p.notifyOnPublish,
          updatedAt: p.updatedAt.toISOString(),
        },
        tags: data.tags,
        revisions: data.revisions.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        grants: data.grants,
        collections: data.collections.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
        emailed: data.emailed,
        tree: data.tree.map((t) => ({ id: t.id, title: t.title, status: t.status, visibility: t.visibility, collectionId: t.collectionId })),
        siteUrl: SITE.url,
      }}
    />
  )
}
