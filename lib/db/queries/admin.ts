import 'server-only'
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { withScope, type Tx } from '../client'
import {
  accessGrants,
  collections,
  emailCampaigns,
  postRevisions,
  posts,
  postTags,
  postViewsDaily,
  projects,
  siteSettings,
  subscribers,
  tags,
} from '../schema'

// Owner-only reads for /admin. Callers must have passed requireOwner() first.
const asOwner = <T>(userId: string, fn: (tx: Tx) => Promise<T>) => withScope({ role: 'owner', userId }, fn)

const notDeleted = isNull(posts.deletedAt)

export async function getDashboard(userId: string) {
  return asOwner(userId, async (tx) => {
    const drafts = await tx
      .select({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        wordCount: posts.wordCount,
        updatedAt: posts.updatedAt,
        scheduledAt: posts.scheduledAt,
        collection: collections.name,
        draft: posts.draftJson,
      })
      .from(posts)
      .leftJoin(collections, eq(collections.id, posts.collectionId))
      .where(and(notDeleted, inArray(posts.status, ['draft', 'scheduled'])))
      .orderBy(desc(posts.updatedAt))
      .limit(3)

    const recent = await tx
      .select({ id: posts.id, title: posts.title, visibility: posts.visibility, publishedAt: posts.publishedAt })
      .from(posts)
      .where(and(notDeleted, eq(posts.status, 'published')))
      .orderBy(desc(posts.publishedAt))
      .limit(4)
    const sharedCounts = await grantCounts(
      tx,
      recent.map((r) => r.id),
    )

    const [stats] = await tx
      .select({
        published: sql<number>`count(*) filter (where ${posts.status} = 'published' and ${posts.kind} = 'blog')`,
        drafts: sql<number>`count(*) filter (where ${posts.status} = 'draft')`,
        scheduled: sql<number>`count(*) filter (where ${posts.status} = 'scheduled')`,
        diary: sql<number>`count(*) filter (where ${posts.kind} = 'diary')`,
      })
      .from(posts)
      .where(notDeleted)
    const [subs] = await tx.select({ n: count() }).from(subscribers).where(eq(subscribers.status, 'confirmed'))
    const [setting] = await tx.select().from(siteSettings).where(eq(siteSettings.key, 'emailOnPublishDefault'))

    return {
      drafts,
      recent: recent.map((r) => ({ ...r, sharedCount: sharedCounts.get(r.id) ?? 0 })),
      stats: {
        published: Number(stats?.published ?? 0),
        drafts: Number(stats?.drafts ?? 0),
        scheduled: Number(stats?.scheduled ?? 0),
        diary: Number(stats?.diary ?? 0),
        subscribers: Number(subs?.n ?? 0),
      },
      emailOnPublishDefault: setting ? setting.value !== false : true,
    }
  })
}

async function grantCounts(tx: Tx, ids: string[]) {
  if (!ids.length) return new Map<string, number>()
  const rows = await tx
    .select({ postId: accessGrants.postId, n: count() })
    .from(accessGrants)
    .where(and(inArray(accessGrants.postId, ids), isNull(accessGrants.revokedAt)))
    .groupBy(accessGrants.postId)
  return new Map(rows.map((r) => [r.postId!, Number(r.n)]))
}

export async function getAdminPosts(userId: string) {
  return asOwner(userId, async (tx) => {
    const rows = await tx
      .select({
        id: posts.id,
        kind: posts.kind,
        title: posts.title,
        slug: posts.slug,
        status: posts.status,
        visibility: posts.visibility,
        updatedAt: posts.updatedAt,
        publishedAt: posts.publishedAt,
        scheduledAt: posts.scheduledAt,
        collection: collections.name,
        views: sql<number>`coalesce((select sum(${postViewsDaily.views}) from ${postViewsDaily} where ${postViewsDaily.postId} = ${posts.id}), 0)`,
      })
      .from(posts)
      .leftJoin(collections, eq(collections.id, posts.collectionId))
      .where(notDeleted)
      .orderBy(desc(posts.updatedAt))
    const ids = rows.map((r) => r.id)
    const tagRows = ids.length
      ? await tx
          .select({ postId: postTags.postId, slug: tags.slug })
          .from(postTags)
          .innerJoin(tags, eq(tags.id, postTags.tagId))
          .where(inArray(postTags.postId, ids))
      : []
    const shared = await grantCounts(tx, ids)
    return rows.map((r) => ({
      ...r,
      views: Number(r.views),
      tags: tagRows.filter((t) => t.postId === r.id).map((t) => t.slug),
      sharedCount: shared.get(r.id) ?? 0,
    }))
  })
}

export async function getEditorData(userId: string, postId: string) {
  return asOwner(userId, async (tx) => {
    const post = await tx.query.posts.findFirst({ where: and(eq(posts.id, postId), notDeleted) })
    if (!post) return null
    const [tagRows, revisions, grants, cols, campaign, tree] = await Promise.all([
      tx
        .select({ slug: tags.slug })
        .from(postTags)
        .innerJoin(tags, eq(tags.id, postTags.tagId))
        .where(eq(postTags.postId, postId)),
      tx
        .select({ id: postRevisions.id, version: postRevisions.version, reason: postRevisions.reason, createdAt: postRevisions.createdAt })
        .from(postRevisions)
        .where(eq(postRevisions.postId, postId))
        .orderBy(desc(postRevisions.createdAt))
        .limit(30),
      tx
        .select({ id: accessGrants.id, email: accessGrants.email })
        .from(accessGrants)
        .where(and(eq(accessGrants.postId, postId), eq(accessGrants.scope, 'post'), isNull(accessGrants.revokedAt))),
      tx.select().from(collections).orderBy(asc(collections.position)),
      tx.select({ id: emailCampaigns.id }).from(emailCampaigns).where(eq(emailCampaigns.postId, postId)).limit(1),
      tx
        .select({ id: posts.id, title: posts.title, status: posts.status, visibility: posts.visibility, collectionId: posts.collectionId, scheduledAt: posts.scheduledAt })
        .from(posts)
        .where(notDeleted)
        .orderBy(desc(posts.updatedAt))
        .limit(60),
    ])
    return {
      post,
      tags: tagRows.map((t) => t.slug),
      revisions,
      grants,
      collections: cols,
      emailed: campaign.length > 0,
      tree,
    }
  })
}

export async function getRevision(userId: string, postId: string, revisionId: string) {
  return asOwner(userId, async (tx) => {
    const [r] = await tx
      .select()
      .from(postRevisions)
      .where(and(eq(postRevisions.id, revisionId), eq(postRevisions.postId, postId)))
    return r ?? null
  })
}

const maskEmail = (email: string) => {
  const [user, domain] = email.split('@')
  return `${(user ?? '').slice(0, 1)}***@${domain ?? ''}`
}

export async function getManageData(userId: string) {
  return asOwner(userId, async (tx) => {
    const [cols, counts, projs, subs, grants, settings] = await Promise.all([
      tx.select().from(collections).orderBy(asc(collections.position)),
      tx
        .select({ collectionId: posts.collectionId, n: count() })
        .from(posts)
        .where(and(notDeleted, eq(posts.status, 'published')))
        .groupBy(posts.collectionId),
      tx.select().from(projects).orderBy(asc(projects.position)),
      tx
        .select({ id: subscribers.id, email: subscribers.email, status: subscribers.status, topics: subscribers.topics, createdAt: subscribers.createdAt })
        .from(subscribers)
        .orderBy(desc(subscribers.createdAt))
        .limit(500),
      tx
        .select({
          id: accessGrants.id,
          email: accessGrants.email,
          scope: accessGrants.scope,
          postTitle: posts.title,
          createdAt: accessGrants.createdAt,
        })
        .from(accessGrants)
        .leftJoin(posts, eq(posts.id, accessGrants.postId))
        .where(isNull(accessGrants.revokedAt))
        .orderBy(desc(accessGrants.createdAt)),
      tx.select().from(siteSettings),
    ])
    const countMap = new Map(counts.map((c) => [c.collectionId, Number(c.n)]))
    return {
      collections: cols.map((c) => ({ ...c, count: countMap.get(c.id) ?? 0 })),
      projects: projs,
      subscribers: subs.map((s) => ({ ...s, masked: maskEmail(s.email) })),
      subscriberStats: {
        confirmed: subs.filter((s) => s.status === 'confirmed').length,
        pending: subs.filter((s) => s.status === 'pending').length,
      },
      grants,
      settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    }
  })
}

export async function exportSubscribersCsv(userId: string) {
  return asOwner(userId, async (tx) => {
    const rows = await tx.select().from(subscribers).orderBy(asc(subscribers.createdAt))
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = rows.map((r) =>
      [r.email, r.status, r.topics.join(';'), r.createdAt.toISOString(), r.confirmedAt?.toISOString() ?? ''].map(q).join(','),
    )
    return ['email,status,topics,created_at,confirmed_at', ...lines].join('\n')
  })
}

export async function getAdminCounts(userId: string) {
  return asOwner(userId, async (tx) => {
    const [row] = await tx
      .select({
        posts: sql<number>`count(*) filter (where ${posts.kind} = 'blog')`,
        drafts: sql<number>`count(*) filter (where ${posts.status} = 'draft')`,
        diary: sql<number>`count(*) filter (where ${posts.kind} = 'diary')`,
      })
      .from(posts)
      .where(notDeleted)
    return { posts: Number(row?.posts ?? 0), drafts: Number(row?.drafts ?? 0), diary: Number(row?.diary ?? 0) }
  })
}
