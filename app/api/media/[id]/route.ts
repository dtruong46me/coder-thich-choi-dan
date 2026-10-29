import { eq, sql } from 'drizzle-orm'
import { scopeFor, getViewer } from '@/lib/access'
import { asSystem, withScope } from '@/lib/db/client'
import { media, posts } from '@/lib/db/schema'
import { signedGetUrl } from '@/lib/storage'

/**
 * Media without a public URL (private diary images, or everything when no R2 public host is set).
 * Private files are handed out as a 5-minute signed URL only if the viewer can read a post that uses them.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 })
  const file = await asSystem((tx) => tx.query.media.findFirst({ where: eq(media.id, id) }))
  if (!file) return new Response('Not found', { status: 404 })

  if (file.bucket === 'private') {
    const viewer = await getViewer()
    if (viewer.kind !== 'owner') {
      // RLS limits this to posts the viewer may read.
      const used = await withScope(scopeFor(viewer), (tx) =>
        tx
          .select({ id: posts.id })
          .from(posts)
          .where(sql`${posts.publishedHtml} like ${`%/api/media/${id}%`}`)
          .limit(1),
      )
      if (!used.length) return new Response('Not found', { status: 404 })
    }
  }
  const url = await signedGetUrl(file.storageKey, file.bucket)
  return new Response(null, {
    status: 302,
    headers: { location: url, 'cache-control': file.bucket === 'private' ? 'private, no-store' : 'public, max-age=240' },
  })
}
