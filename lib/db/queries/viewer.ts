import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { canRead, scopeFor, type Viewer } from '@/lib/access'
import { withScope } from '../client'
import { collections, posts } from '../schema'
import { loadPost, published, type PublicPost } from './public'

// Per-viewer reads. Never cached on the server: Members, Shared and Private pages are `private, no-store`.

/** A post this viewer may read, by slug. RLS filters the row; canRead() checks again. */
export async function getPostForViewer(viewer: Viewer, slug: string): Promise<PublicPost | null> {
  return withScope(scopeFor(viewer), async (tx) => {
    const post = await loadPost(tx, and(viewer.kind === 'owner' ? undefined : published, eq(posts.slug, slug)))
    if (!post) return null
    const [row] = await tx
      .select({ id: posts.id, kind: posts.kind, status: posts.status, visibility: posts.visibility, deletedAt: posts.deletedAt, unlistedToken: posts.unlistedToken })
      .from(posts)
      .where(eq(posts.id, post.id))
    // Unlisted posts are only reachable through their /u/<token> link, not by slug.
    if (!row || (row.visibility === 'unlisted' && viewer.kind !== 'owner')) return null
    return canRead(viewer, row) ? post : null
  })
}

/** What a locked card may reveal: that the post exists, its mode, date and collection. */
export async function getLockedStub(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return withScope({ role: 'anon' }, async (tx) => {
    const rows = await tx.execute<{ id: string; visibility: string; published_at: Date | null; collection_id: string | null }>(
      sql`select * from locked_post_stubs() where id = ${id}`,
    )
    const stub = [...rows][0]
    if (!stub) return null
    const col = stub.collection_id
      ? await tx.select({ name: collections.name }).from(collections).where(eq(collections.id, stub.collection_id))
      : []
    return { id: stub.id, visibility: stub.visibility, publishedAt: stub.published_at, collection: col[0]?.name ?? null }
  })
}

/** The slug of a post the viewer may read, by id (used by /read/<id> from locked cards). */
export async function getReadableSlug(viewer: Viewer, id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return withScope(scopeFor(viewer), async (tx) => {
    const [row] = await tx
      .select({ id: posts.id, slug: posts.slug, kind: posts.kind, status: posts.status, visibility: posts.visibility, deletedAt: posts.deletedAt })
      .from(posts)
      .where(eq(posts.id, id))
    return row && row.visibility !== 'unlisted' && canRead(viewer, row) ? row.slug : null
  })
}
