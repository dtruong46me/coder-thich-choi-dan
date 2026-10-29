// Pure access rules: no database, no Next.js. lib/access.ts wires them to the session;
// the same rules are mirrored in SQL by the RLS policies in drizzle/0001_rls_search.sql.
import type { PostKind, PostStatus, Visibility } from './db/schema'

export type Grant = {
  scope: 'post' | 'all_shared_diary' | 'members'
  postId: string | null
  expiresAt: Date | null
  revokedAt: Date | null
}

export type Viewer =
  | { kind: 'anon' }
  | { kind: 'reader'; userId: string; email: string; isMember: boolean; grants: Grant[] }
  | { kind: 'owner'; userId: string; email: string }

export type PostAccess = {
  id: string
  kind: PostKind
  status: PostStatus
  visibility: Visibility
  deletedAt: Date | null
  unlistedToken?: string | null
}

export const ANON: Viewer = { kind: 'anon' }

export function isGrantActive(g: Grant, now: Date = new Date()): boolean {
  return g.revokedAt === null && (g.expiresAt === null || g.expiresAt > now)
}

/**
 * The single rule for who may read a post. Every query that can return a non-public post
 * goes through this function (and through RLS as a second layer).
 *
 * `unlistedToken` is the token from a /u/<token> link; unlisted posts are readable only with it.
 */
export function canRead(
  viewer: Viewer,
  post: PostAccess,
  opts: { unlistedToken?: string; now?: Date } = {},
): boolean {
  if (viewer.kind === 'owner') return true
  if (post.deletedAt !== null || post.status !== 'published') return false

  const now = opts.now ?? new Date()
  const grants = viewer.kind === 'reader' ? viewer.grants.filter((g) => isGrantActive(g, now)) : []

  switch (post.visibility) {
    case 'public':
      return true
    case 'unlisted':
      return !!opts.unlistedToken && !!post.unlistedToken && opts.unlistedToken === post.unlistedToken
    case 'members':
      return viewer.kind === 'reader' && (viewer.isMember || grants.some((g) => g.scope === 'members'))
    case 'shared':
      return grants.some(
        (g) =>
          (g.scope === 'post' && g.postId === post.id) || (g.scope === 'all_shared_diary' && post.kind === 'diary'),
      )
    case 'private':
      return false
  }
}

/** Only these two modes may ever enter a shared (CDN / `use cache`) cache. */
export const CACHEABLE_VISIBILITY: readonly Visibility[] = ['public', 'unlisted']

/** Public posts are the only ones in RSS, the sitemap, anonymous search and email. */
export const isIndexable = (p: Pick<PostAccess, 'visibility' | 'status' | 'deletedAt'>) =>
  p.visibility === 'public' && p.status === 'published' && p.deletedAt === null

/** Diary entries are never emailed, even after being switched to Public. */
export const canEmail = (p: Pick<PostAccess, 'visibility' | 'kind'>) => p.visibility === 'public' && p.kind === 'blog'

/** Locked cards only ever carry these fields: no title, excerpt or tags. */
export type LockedCard = {
  id: string
  locked: true
  visibility: Visibility
  publishedAt: Date | null
  collection: { slug: string; name: string } | null
}
