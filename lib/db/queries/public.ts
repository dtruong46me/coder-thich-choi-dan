import 'server-only'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import type { Visibility } from '../schema'
import { TAGS } from '@/lib/cache-tags'
import { asAnon, withScope, type Tx } from '../client'
import { collections, posts, postTags, projects, siteSettings, tags } from '../schema'

// Everything in this file runs as `anon` and may enter the shared cache.
// Only Public posts (and Unlisted ones, by token) are ever returned with content.

export type CollectionRef = { slug: string; name: string }

export type OpenCard = {
  id: string
  locked: false
  slug: string
  kind: 'blog' | 'diary'
  title: string
  excerpt: string
  tags: string[]
  collection: CollectionRef | null
  publishedAt: string
  readingMinutes: number
  visibility: 'public'
}
export type ClosedCard = {
  id: string
  locked: true
  kind: 'blog' | 'diary'
  visibility: Visibility
  publishedAt: string
  collection: CollectionRef | null
}
export type Card = OpenCard | ClosedCard

const iso = (d: Date | null) => (d ?? new Date(0)).toISOString()

async function tagsFor(tx: Tx, ids: string[]) {
  if (!ids.length) return new Map<string, string[]>()
  const rows = await tx
    .select({ postId: postTags.postId, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(inArray(postTags.postId, ids))
    .orderBy(asc(tags.slug))
  const map = new Map<string, string[]>()
  for (const r of rows) map.set(r.postId, [...(map.get(r.postId) ?? []), r.slug])
  return map
}

/** Every listed post: Public ones in full, Members/Shared/Private ones as locked cards. Unlisted never. */
export async function getListing(): Promise<Card[]> {
  'use cache'
  cacheLife('max')
  cacheTag(TAGS.posts, TAGS.collections)

  return asAnon(async (tx) => {
    const open = await tx
      .select({
        id: posts.id,
        slug: posts.slug,
        kind: posts.kind,
        title: posts.title,
        excerpt: posts.excerpt,
        publishedAt: posts.publishedAt,
        readingMinutes: posts.readingMinutes,
        colSlug: collections.slug,
        colName: collections.name,
      })
      .from(posts)
      .leftJoin(collections, eq(collections.id, posts.collectionId))
      .where(and(eq(posts.status, 'published'), eq(posts.visibility, 'public'), isNull(posts.deletedAt)))
      .orderBy(desc(posts.publishedAt), desc(posts.id))

    const stubs = await tx.execute<{
      id: string
      kind: 'blog' | 'diary'
      visibility: Visibility
      published_at: string | Date | null
      collection_id: string | null
    }>(sql`select * from locked_post_stubs()`)
    const cols = await tx.select({ id: collections.id, slug: collections.slug, name: collections.name }).from(collections)
    const colById = new Map(cols.map((c) => [c.id, { slug: c.slug, name: c.name }]))
    const tagMap = await tagsFor(
      tx,
      open.map((p) => p.id),
    )

    const cards: Card[] = [
      ...open.map(
        (p): OpenCard => ({
          id: p.id,
          locked: false,
          slug: p.slug,
          kind: p.kind,
          title: p.title,
          excerpt: p.excerpt,
          tags: tagMap.get(p.id) ?? [],
          collection: p.colSlug ? { slug: p.colSlug, name: p.colName ?? '' } : null,
          publishedAt: iso(p.publishedAt),
          readingMinutes: p.readingMinutes,
          visibility: 'public',
        }),
      ),
      ...[...stubs].map(
        (s): ClosedCard => ({
          id: s.id,
          locked: true,
          kind: s.kind,
          visibility: s.visibility,
          publishedAt: iso(s.published_at ? new Date(s.published_at) : null),
          collection: s.collection_id ? (colById.get(s.collection_id) ?? null) : null,
        }),
      ),
    ]
    return cards.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  })
}

export type CollectionSummary = {
  id: string
  slug: string
  name: string
  description: string
  position: number
  defaultVisibility: Visibility
}

export async function getCollections(): Promise<CollectionSummary[]> {
  'use cache'
  cacheLife('max')
  cacheTag(TAGS.collections)
  return asAnon((tx) =>
    tx
      .select({
        id: collections.id,
        slug: collections.slug,
        name: collections.name,
        description: collections.description,
        position: collections.position,
        defaultVisibility: collections.defaultVisibility,
      })
      .from(collections)
      .orderBy(asc(collections.position), asc(collections.name)),
  )
}

export type PublicPost = {
  id: string
  slug: string
  kind: 'blog' | 'diary'
  title: string
  excerpt: string
  html: string
  toc: { id: string; text: string; level: number }[]
  publishedAt: string
  updatedAt: string
  readingMinutes: number
  wordCount: number
  tags: string[]
  collection: CollectionRef | null
  visibility: Visibility
}

export async function loadPost(tx: Tx, where: ReturnType<typeof and>): Promise<PublicPost | null> {
  const [p] = await tx
    .select({
      id: posts.id,
      slug: posts.slug,
      kind: posts.kind,
      title: posts.title,
      excerpt: posts.excerpt,
      html: posts.publishedHtml,
      toc: posts.publishedToc,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      readingMinutes: posts.readingMinutes,
      wordCount: posts.wordCount,
      visibility: posts.visibility,
      colSlug: collections.slug,
      colName: collections.name,
    })
    .from(posts)
    .leftJoin(collections, eq(collections.id, posts.collectionId))
    .where(where)
    .limit(1)
  if (!p || p.html === null) return null
  const tagMap = await tagsFor(tx, [p.id])
  return {
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    excerpt: p.excerpt,
    html: p.html,
    toc: p.toc ?? [],
    publishedAt: iso(p.publishedAt),
    updatedAt: iso(p.updatedAt),
    readingMinutes: p.readingMinutes,
    wordCount: p.wordCount,
    tags: tagMap.get(p.id) ?? [],
    collection: p.colSlug ? { slug: p.colSlug, name: p.colName ?? '' } : null,
    visibility: p.visibility,
  }
}

export const published = and(eq(posts.status, 'published'), isNull(posts.deletedAt))

/** A Public post by slug, prerendered and cached until it is republished. */
export async function getPublicPost(slug: string): Promise<PublicPost | null> {
  'use cache'
  cacheLife('max')
  cacheTag(TAGS.posts)
  const post = await asAnon((tx) => loadPost(tx, and(published, eq(posts.slug, slug), eq(posts.visibility, 'public'))))
  if (post) cacheTag(TAGS.post(post.id))
  return post
}

/** An Unlisted post by its /u/<token> link. Cached per URL. */
export async function getUnlistedPost(token: string): Promise<PublicPost | null> {
  'use cache'
  cacheLife('max')
  cacheTag(TAGS.posts)
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return null
  const post = await withScope({ role: 'anon', unlistedToken: token }, (tx) =>
    loadPost(tx, and(published, eq(posts.visibility, 'unlisted'), eq(posts.unlistedToken, token))),
  )
  if (post) cacheTag(TAGS.post(post.id))
  return post
}

/** Public posts for RSS, the sitemap and generateStaticParams. */
export async function getPublicIndex() {
  'use cache'
  cacheLife('max')
  cacheTag(TAGS.posts)
  return asAnon(async (tx) => {
    const rows = await tx
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        publishedAt: posts.publishedAt,
        updatedAt: posts.updatedAt,
        colName: collections.name,
      })
      .from(posts)
      .leftJoin(collections, eq(collections.id, posts.collectionId))
      .where(and(published, eq(posts.visibility, 'public')))
      .orderBy(desc(posts.publishedAt))
    return rows.map((r) => ({ ...r, publishedAt: iso(r.publishedAt), updatedAt: iso(r.updatedAt) }))
  })
}

export type ProjectCard = {
  id: string
  slug: string
  name: string
  kind: string
  status: 'shipped' | 'in_progress' | 'archived'
  year: string
  description: string
  stack: string[]
  links: { label: string; href: string }[]
  featured: boolean
  postSlug: string | null
}

export async function getProjects(): Promise<ProjectCard[]> {
  'use cache'
  cacheLife('max')
  cacheTag(TAGS.projects, TAGS.posts)
  return asAnon(async (tx) => {
    const rows = await tx
      .select({
        id: projects.id,
        slug: projects.slug,
        name: projects.name,
        kind: projects.kind,
        status: projects.status,
        year: projects.year,
        description: projects.description,
        stack: projects.stack,
        links: projects.links,
        featured: projects.featured,
        postSlug: posts.slug, // RLS: null unless the linked post is Public
      })
      .from(projects)
      .leftJoin(posts, and(eq(posts.id, projects.postId), eq(posts.visibility, 'public')))
      .orderBy(asc(projects.position), asc(projects.name))
    return rows
  })
}

export type SiteSettings = {
  name: string
  handle: string
  tagline: string
  defaultTheme: 'light' | 'dark' | 'auto'
  membersSignup: boolean
  socials: Record<string, string>
  emailOnPublishDefault: boolean
}

export const DEFAULT_SETTINGS: SiteSettings = {
  name: 'Coder thích chơi đàn',
  handle: '@coderthichchoidan',
  tagline: 'A coder who plays guitar & piano, keeping notes',
  defaultTheme: 'auto',
  membersSignup: true,
  socials: {},
  emailOnPublishDefault: true,
}

export async function getSettings(): Promise<SiteSettings> {
  'use cache'
  cacheLife('max')
  cacheTag(TAGS.settings)
  const rows = await asAnon((tx) => tx.select().from(siteSettings))
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const r of rows) out[r.key] = r.value
  return out as SiteSettings
}
