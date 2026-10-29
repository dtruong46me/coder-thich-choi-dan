import 'server-only'
import { and, eq, inArray, isNull, notExists, sql } from 'drizzle-orm'
import { createElement } from 'react'
import NewPost from '@/emails/NewPost'
import { asSystem } from '../db/client'
import { collections, emailCampaigns, emailDeliveries, posts, postViewsDaily, subscribers } from '../db/schema'
import { sendBatch } from '../email/send'
import { signUnsubscribe } from '../email/tokens'
import { publishPost } from '../publish'
import { redis } from '../redis'
import { absoluteUrl, COLLECTION_TOPIC } from '../site'
import { memoryViews } from '../views'
import type { JobEvent } from './client'

export const BATCH_SIZE = 100

/**
 * Sends the next batch of a campaign. Returns how many were sent; 0 means the campaign is done.
 * Safe to re-run after a crash: anyone with an email_deliveries row for this campaign is skipped,
 * and the provider call carries an idempotency key, so nobody gets the post twice.
 */
export async function sendCampaignBatch(campaignId: string): Promise<number> {
  const ctx = await asSystem(async (tx) => {
    const [row] = await tx
      .select({
        status: emailCampaigns.status,
        postId: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        kind: posts.kind,
        visibility: posts.visibility,
        postStatus: posts.status,
        deletedAt: posts.deletedAt,
        colSlug: collections.slug,
        colName: collections.name,
      })
      .from(emailCampaigns)
      .innerJoin(posts, eq(posts.id, emailCampaigns.postId))
      .leftJoin(collections, eq(collections.id, posts.collectionId))
      .where(eq(emailCampaigns.id, campaignId))
    if (!row || row.status === 'done' || row.status === 'failed') return null
    // Re-check at send time: a post made private (or a diary entry) must never go out.
    if (row.kind !== 'blog' || row.visibility !== 'public' || row.postStatus !== 'published' || row.deletedAt) {
      await tx.update(emailCampaigns).set({ status: 'failed', finishedAt: new Date() }).where(eq(emailCampaigns.id, campaignId))
      return null
    }
    if (row.status === 'queued') await tx.update(emailCampaigns).set({ status: 'sending' }).where(eq(emailCampaigns.id, campaignId))

    const topic = row.colSlug ? COLLECTION_TOPIC[row.colSlug] : undefined
    const recipients = await tx
      .select({ id: subscribers.id, email: subscribers.email })
      .from(subscribers)
      .where(
        and(
          eq(subscribers.status, 'confirmed'),
          topic ? sql`(cardinality(${subscribers.topics}) = 0 OR ${topic} = ANY(${subscribers.topics}))` : undefined,
          notExists(
            tx
              .select({ one: sql`1` })
              .from(emailDeliveries)
              .where(and(eq(emailDeliveries.campaignId, campaignId), eq(emailDeliveries.subscriberId, subscribers.id))),
          ),
        ),
      )
      .orderBy(subscribers.id)
      .limit(BATCH_SIZE)
    return { row, recipients }
  })

  if (!ctx) return 0
  const { row, recipients } = ctx
  if (!recipients.length) {
    await asSystem((tx) =>
      tx.update(emailCampaigns).set({ status: 'done', finishedAt: new Date() }).where(eq(emailCampaigns.id, campaignId)),
    )
    return 0
  }

  const url = absoluteUrl(`/blogs/${row.slug}`)
  const mails = recipients.map((r) => {
    const unsub = absoluteUrl(`/api/unsubscribe?token=${signUnsubscribe(r.id)}`)
    return {
      to: r.email,
      subject: row.title,
      react: createElement(NewPost, {
        title: row.title,
        excerpt: row.excerpt,
        url,
        collection: row.colName ?? 'Coder thích chơi đàn',
        unsubscribeUrl: unsub,
      }),
      // Gmail and Yahoo require one-click unsubscribe for bulk senders.
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }
  })
  const ids = await sendBatch(mails, `campaign:${campaignId}:${recipients[0]!.id}`)

  await asSystem((tx) =>
    tx
      .insert(emailDeliveries)
      .values(recipients.map((r, i) => ({ campaignId, subscriberId: r.id, providerMessageId: ids[i] ?? null })))
      .onConflictDoNothing(),
  )
  return recipients.length
}

/** Fires at scheduled_at. Publishes only if the post is still scheduled for (no later than) that time. */
export async function publishScheduled(postId: string): Promise<'published' | 'skipped'> {
  const post = await asSystem(async (tx) => {
    const [p] = await tx
      .select({ status: posts.status, scheduledAt: posts.scheduledAt, notify: posts.notifyOnPublish })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    return p
  })
  if (!post || post.status !== 'scheduled' || !post.scheduledAt || post.scheduledAt.getTime() > Date.now() + 30_000) {
    return 'skipped'
  }
  await publishPost(postId, { notify: post.notify })
  return 'published'
}

/** Nightly: keep every revision for 24 h, then one per hour up to 7 days, then one per day. Publish revisions stay forever. */
export async function cleanupRevisions(): Promise<number> {
  return asSystem(async (tx) => {
    const res = await tx.execute(sql`
      DELETE FROM post_revisions r USING (
        SELECT id, row_number() OVER (
          PARTITION BY post_id,
            CASE WHEN created_at > now() - interval '7 days' THEN date_trunc('hour', created_at)
                 ELSE date_trunc('day', created_at) END
          ORDER BY created_at DESC
        ) AS rn
        FROM post_revisions
        WHERE reason <> 'publish' AND created_at < now() - interval '24 hours'
      ) x
      WHERE r.id = x.id AND x.rn > 1`)
    return res.count ?? 0
  })
}

/** Every 10 minutes: move view counters from Redis into post_views_daily. */
export async function flushViews(): Promise<number> {
  const counts: { postId: string; day: string; views: number }[] = []
  if (redis) {
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(cursor, { match: 'views:*', count: 200 })
      cursor = String(next)
      for (const key of keys) {
        const n = Number(await redis.getdel(key))
        const [, postId, day] = key.split(':')
        if (postId && day && n > 0) counts.push({ postId, day, views: n })
      }
    } while (cursor !== '0')
  } else {
    for (const [key, n] of memoryViews.drain()) {
      const [postId, day] = key.split(':')
      if (postId && day) counts.push({ postId, day, views: n })
    }
  }
  if (!counts.length) return 0
  await asSystem(async (tx) => {
    const ids = [...new Set(counts.map((c) => c.postId))]
    const known = new Set(
      (await tx.select({ id: posts.id }).from(posts).where(inArray(posts.id, ids))).map((p) => p.id),
    )
    const rows = counts.filter((c) => known.has(c.postId))
    if (!rows.length) return
    await tx
      .insert(postViewsDaily)
      .values(rows)
      .onConflictDoUpdate({
        target: [postViewsDaily.postId, postViewsDaily.day],
        set: { views: sql`${postViewsDaily.views} + excluded.views` },
      })
  })
  return counts.length
}

/** Renders the OG image once right after publish so the first share is fast. */
export async function warmOgImage(slug: string) {
  await fetch(absoluteUrl(`/og/${slug}`)).catch(() => undefined)
}

/** Local fallback when no job queue is configured. Same work, no retries. */
export async function runInline(event: JobEvent) {
  switch (event.name) {
    case 'post/published':
      return warmOgImage(event.data.slug)
    case 'email/campaign.created':
      while ((await sendCampaignBatch(event.data.campaignId)) > 0) {}
      return
    case 'post/scheduled': {
      const wait = new Date(event.data.at).getTime() - Date.now()
      if (wait <= 0) await publishScheduled(event.data.postId)
      else console.info(`[jobs] post ${event.data.postId} is scheduled; run the Inngest dev server to publish it on time.`)
      return
    }
  }
}
