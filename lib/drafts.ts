import 'server-only'
import { and, desc, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm'
import type { Tx } from './db/client'
import { postRevisions, posts, postTags, tags } from './db/schema'
import { countWords, docToText, readingMinutes } from './content/text'
import type { Doc } from './content/types'
import { slugify } from './slug'
import type { saveDraftInput } from './validation'
import type { z } from 'zod'

export type SaveResult =
  | { ok: true; version: number; savedAt: string; slug?: string; slugTaken?: boolean }
  | { ok: false; error: string; conflict?: { version: number; title: string; draftJson: unknown; updatedAt: string } }

/**
 * Optimistic concurrency: the UPDATE only applies if the client's baseVersion is still current.
 * If another tab or device saved in between, nothing is overwritten and the caller gets a 409-style conflict.
 * Runs inside the caller's owner-scoped transaction.
 */
export async function writeDraft(tx: Tx, input: z.output<typeof saveDraftInput>): Promise<SaveResult> {
  const meta = input.meta ?? {}
  const words = countWords(docToText(input.draftJson as Doc))
  let slug = meta.slug
  let slugTaken = false
  if (slug) {
    const [clash] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.slug, slug), ne(posts.id, input.postId)))
      .limit(1)
    if (clash) {
      slugTaken = true
      slug = undefined
    }
  }

  const [updated] = await tx
    .update(posts)
    .set({
      title: input.title,
      draftJson: input.draftJson,
      draftVersion: sql`${posts.draftVersion} + 1`,
      // Kept current while drafting so the dashboard can show "640 words"; publish recomputes them.
      wordCount: words,
      readingMinutes: readingMinutes(words),
      ...(slug ? { slug } : {}),
      ...(meta.excerpt !== undefined ? { excerpt: meta.excerpt } : {}),
      ...(meta.collectionId !== undefined ? { collectionId: meta.collectionId } : {}),
      ...(meta.kind ? { kind: meta.kind } : {}),
      ...(meta.notifyOnPublish !== undefined ? { notifyOnPublish: meta.notifyOnPublish } : {}),
    })
    .where(and(eq(posts.id, input.postId), eq(posts.draftVersion, input.baseVersion), isNull(posts.deletedAt)))
    .returning({ version: posts.draftVersion, updatedAt: posts.updatedAt, slug: posts.slug })

  if (!updated) {
    const [cur] = await tx
      .select({ version: posts.draftVersion, title: posts.title, draftJson: posts.draftJson, updatedAt: posts.updatedAt })
      .from(posts)
      .where(eq(posts.id, input.postId))
    if (!cur) return { ok: false, error: 'This post was deleted.' }
    // Keep both sides in History whichever one the writer picks: the rejected edit and the version that won.
    const [latest] = await tx
      .select({ version: postRevisions.version })
      .from(postRevisions)
      .where(eq(postRevisions.postId, input.postId))
      .orderBy(desc(postRevisions.createdAt))
      .limit(1)
    if (latest?.version !== cur.version) {
      await tx.insert(postRevisions).values({ postId: input.postId, version: cur.version, title: cur.title, contentJson: cur.draftJson, reason: 'autosave' })
    }
    await tx.insert(postRevisions).values({ postId: input.postId, version: cur.version, title: input.title, contentJson: input.draftJson, reason: 'autosave' })
    return { ok: false, error: 'conflict', conflict: { ...cur, updatedAt: cur.updatedAt.toISOString() } }
  }

  if (meta.tags) await setTags(tx, input.postId, meta.tags)

  // Manual saves always make a revision; autosaves at most one every 2 minutes.
  const recent =
    input.reason === 'autosave'
      ? await tx
          .select({ id: postRevisions.id })
          .from(postRevisions)
          .where(
            and(
              eq(postRevisions.postId, input.postId),
              eq(postRevisions.reason, 'autosave'),
              gt(postRevisions.createdAt, new Date(Date.now() - 2 * 60_000)),
            ),
          )
          .limit(1)
      : []
  if (!recent.length) {
    await tx.insert(postRevisions).values({
      postId: input.postId,
      version: updated.version,
      title: input.title,
      contentJson: input.draftJson,
      reason: input.reason,
    })
  }
  return { ok: true, version: updated.version, savedAt: updated.updatedAt.toISOString(), slug: updated.slug, slugTaken }
}

export async function setTags(tx: Tx, postId: string, slugs: string[]) {
  const unique = [...new Set(slugs.map((s) => slugify(s)).filter(Boolean))]
  await tx.delete(postTags).where(eq(postTags.postId, postId))
  if (!unique.length) return
  await tx
    .insert(tags)
    .values(unique.map((slug) => ({ slug, name: slug })))
    .onConflictDoNothing()
  const rows = await tx.select({ id: tags.id }).from(tags).where(inArray(tags.slug, unique))
  await tx.insert(postTags).values(rows.map((r) => ({ postId, tagId: r.id })))
}
