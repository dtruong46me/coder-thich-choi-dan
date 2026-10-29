import 'server-only'
import { sql } from 'drizzle-orm'
import { scopeFor, type Viewer } from './access'
import { withScope } from './db/client'

export type SearchHit = {
  id: string
  slug: string
  title: string
  excerpt: string
  visibility: string
  publishedAt: string | null
  collection: string | null
  rank: number
}

/**
 * Full-text (title A, excerpt B, body C) plus trigram similarity on the title, both unaccented,
 * so "dan" finds "đàn" and "hiragna" finds "Hiragana".
 *
 * Strangers only ever search Public posts. Readers also see what they may read (RLS decides).
 * Unlisted posts are never in results except for the owner, who searches everything including drafts.
 */
export async function searchPosts(viewer: Viewer, q: string, limit = 20): Promise<SearchHit[]> {
  const query = q.trim().slice(0, 100)
  if (query.length < 2) return []
  const owner = viewer.kind === 'owner'
  return withScope(scopeFor(viewer), async (tx) => {
    const rows = await tx.execute<{
      id: string
      slug: string
      title: string
      excerpt: string
      visibility: string
      published_at: Date | null
      collection: string | null
      rank: number
    }>(sql`
      WITH q AS (
        SELECT websearch_to_tsquery('simple', f_unaccent(${query})) AS ts,
               f_unaccent(lower(${query})) AS plain
      )
      SELECT p.id, p.slug, p.title, p.excerpt, p.visibility, p.published_at, c.name AS collection,
             (coalesce(ts_rank(p.search_vector, q.ts), 0)
               + word_similarity(q.plain, f_unaccent(lower(p.title)))) AS rank
      FROM posts p
      CROSS JOIN q
      LEFT JOIN collections c ON c.id = p.collection_id
      WHERE p.deleted_at IS NULL
        AND ${owner ? sql`true` : sql`p.status = 'published' AND p.visibility <> 'unlisted'`}
        AND ${viewer.kind === 'anon' ? sql`p.visibility = 'public'` : sql`true`}
        AND (
          p.search_vector @@ q.ts
          OR q.plain <% f_unaccent(lower(p.title))
          ${owner ? sql`OR f_unaccent(lower(p.title)) LIKE '%' || q.plain || '%'` : sql``}
        )
      ORDER BY rank DESC, p.published_at DESC NULLS LAST
      LIMIT ${limit}`)
    return [...rows].map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      visibility: r.visibility,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      collection: r.collection,
      rank: Number(r.rank),
    }))
  })
}
