import 'server-only'
import { and, eq, ne, sql } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { canEmail } from './access-rules'
import { TAGS } from './cache-tags'
import { renderDoc } from './content/render'
import { excerptFrom } from './content/text'
import type { Doc, DocNode } from './content/types'
import { withScope, type DbScope } from './db/client'
import { auditLog, emailCampaigns, postRevisions, posts } from './db/schema'
import { unlistedToken } from './email/tokens'
import { enqueue } from './jobs/client'
import { SLUG_RE } from './slug'

export class PublishError extends Error {
  constructor(public issues: string[]) {
    super(issues.join(' '))
    this.name = 'PublishError'
  }
}

function imagesWithoutAlt(node: DocNode): number {
  const self = node.type === 'image' && !String(node.attrs?.alt ?? '').trim() ? 1 : 0
  return self + (node.content ?? []).reduce((n, c) => n + imagesWithoutAlt(c), 0)
}

export const publishable = z.object({
  title: z.string().trim().min(1, 'Add a title.').max(200),
  slug: z.string().regex(SLUG_RE, 'The URL may only use a-z, 0-9 and dashes.'),
  draftJson: z.custom<Doc>((v) => !!v && typeof v === 'object' && (v as Doc).type === 'doc', 'Content is broken.'),
})

/** Every image needs alt text before it can go out to readers. */
export function validateForPublish(input: { title: string; slug: string; draftJson: unknown }): string[] {
  const parsed = publishable.safeParse(input)
  const issues = parsed.success ? [] : parsed.error.issues.map((i) => i.message)
  if (parsed.success) {
    const missing = imagesWithoutAlt(parsed.data.draftJson)
    if (missing) issues.push(`${missing} image${missing > 1 ? 's need' : ' needs'} alt text.`)
  }
  return issues
}

/** Drop every cached page that could show this post. `expire: 0` so a now-private post is never served stale. */
export function invalidatePost(postId: string) {
  revalidateTag(TAGS.posts, { expire: 0 })
  revalidateTag(TAGS.post(postId), { expire: 0 })
}

type PublishOpts = { notify?: boolean; actorId?: string | null; scope?: DbScope }

/**
 * The only publish path. The admin action and the scheduled-post job both call this,
 * so a scheduled post goes out exactly like one published by hand.
 */
export async function publishPost(postId: string, opts: PublishOpts = {}) {
  const scope: DbScope = opts.scope ?? { role: 'system' }

  const result = await withScope(scope, async (tx) => {
    const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).for('update')
    if (!post || post.deletedAt) throw new PublishError(['This post no longer exists.'])

    const issues = validateForPublish({ title: post.title, slug: post.slug, draftJson: post.draftJson })
    const [clash] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.slug, post.slug), ne(posts.id, post.id)))
      .limit(1)
    if (clash) issues.push('Another post already uses this URL.')
    if (issues.length) throw new PublishError(issues)

    const rendered = await renderDoc(post.draftJson as Doc)
    const excerpt = post.excerpt.trim() || excerptFrom(rendered.text)
    const firstPublish = post.publishedAt === null
    const now = new Date()

    await tx
      .update(posts)
      .set({
        status: 'published',
        publishedHtml: rendered.html,
        publishedToc: rendered.toc,
        publishedAt: post.publishedAt ?? now,
        scheduledAt: null,
        excerpt,
        wordCount: rendered.wordCount,
        readingMinutes: rendered.readingMinutes,
        unlistedToken: post.visibility === 'unlisted' && !post.unlistedToken ? unlistedToken() : post.unlistedToken,
        searchVector: sql`post_search_vector(${post.title}, ${excerpt}, ${rendered.text})`,
        notifyOnPublish: opts.notify ?? post.notifyOnPublish,
      })
      .where(eq(posts.id, post.id))

    await tx.insert(postRevisions).values({
      postId: post.id,
      version: post.draftVersion,
      title: post.title,
      contentJson: post.draftJson,
      reason: 'publish',
    })

    // Email only on the first publish of a Public blog post, and only once per post.
    let campaignId: string | null = null
    const notify = opts.notify ?? post.notifyOnPublish
    if (notify && firstPublish && canEmail(post)) {
      const [existing] = await tx
        .select({ id: emailCampaigns.id })
        .from(emailCampaigns)
        .where(eq(emailCampaigns.postId, post.id))
        .limit(1)
      if (!existing) {
        const [c] = await tx.insert(emailCampaigns).values({ postId: post.id }).returning({ id: emailCampaigns.id })
        campaignId = c!.id
      }
    }

    await tx.insert(auditLog).values({
      actorId: opts.actorId ?? null,
      action: firstPublish ? 'post.publish' : 'post.update',
      targetType: 'post',
      targetId: post.id,
      meta: { visibility: post.visibility, campaignId },
    })

    return { id: post.id, slug: post.slug, visibility: post.visibility, campaignId }
  })

  invalidatePost(result.id)
  await enqueue({ name: 'post/published', data: { postId: result.id, slug: result.slug } })
  if (result.campaignId) await enqueue({ name: 'email/campaign.created', data: { campaignId: result.campaignId } })
  return result
}
