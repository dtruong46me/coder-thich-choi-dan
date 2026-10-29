'use server'

import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOwner } from '../access'
import { auth } from '../auth'
import { emptyDoc } from '../content/types'
import { withScope, type Tx } from '../db/client'
import { accessGrants, auditLog, collections, postRevisions, posts, siteSettings, users } from '../db/schema'
import { unlistedToken } from '../email/tokens'
import { enqueue } from '../jobs/client'
import { writeDraft, type SaveResult } from '../drafts'
import { log, requestId } from '../log'
import { invalidatePost, publishPost as publishCore } from '../publish'
import { uniqueSlug } from '../slug'
import { grantInput, kindEnum, saveDraftInput, uuid, visibilityEnum, type SaveDraftInput } from '../validation'
import { run } from './result'

const ownerTx = <T>(userId: string, fn: (tx: Tx) => Promise<T>) => withScope({ role: 'owner', userId }, fn)

async function freeSlug(tx: Tx, base: string, exceptId?: string) {
  const rows = await tx
    .select({ slug: posts.slug })
    .from(posts)
    .where(and(sql`${posts.slug} like ${`${base}%`}`, exceptId ? ne(posts.id, exceptId) : undefined))
  return uniqueSlug(base, rows.map((r) => r.slug))
}

/* ---------------------------------------------------------------- Create */

async function insertDraft(userId: string, kind: 'blog' | 'diary') {
  return ownerTx(userId, async (tx) => {
    const col =
      kind === 'diary'
        ? await tx.query.collections.findFirst({ where: eq(collections.slug, 'diary') })
        : await tx.query.collections.findFirst({ where: ne(collections.slug, 'diary'), orderBy: collections.position })
    const slug = await freeSlug(tx, kind === 'diary' ? `diary-${new Date().toISOString().slice(0, 10)}` : 'untitled')
    const [emailDefault] = await tx.select().from(siteSettings).where(eq(siteSettings.key, 'emailOnPublishDefault'))
    const [row] = await tx
      .insert(posts)
      .values({
        kind,
        slug,
        collectionId: col?.id ?? null,
        // Diary entries start Private; blog posts take their collection's default.
        visibility: kind === 'diary' ? 'private' : (col?.defaultVisibility ?? 'public'),
        draftJson: emptyDoc(),
        notifyOnPublish: kind === 'blog' && emailDefault?.value !== false,
      })
      .returning({ id: posts.id })
    await tx.insert(postRevisions).values({ postId: row!.id, version: 0, title: '', contentJson: emptyDoc(), reason: 'manual' })
    return row!.id
  })
}

/** Form action for the "New post" / "New diary entry" buttons. */
export async function createPost(formData: FormData) {
  const owner = await requireOwner()
  const kind = kindEnum.parse(formData.get('kind') ?? 'blog')
  const id = await insertDraft(owner.userId, kind)
  redirect(`/admin/editor/${id}`)
}

/** Same, for the ":write" command. */
export async function newPost(kind: 'blog' | 'diary' = 'blog') {
  const owner = await requireOwner()
  return { id: await insertDraft(owner.userId, kindEnum.parse(kind)) }
}

/* ---------------------------------------------------------------- Autosave */

export type { SaveResult } from '../drafts'

/** Autosave and Ctrl+S. See writeDraft for the conflict rules. */
export async function saveDraft(raw: SaveDraftInput): Promise<SaveResult> {
  try {
    const owner = await requireOwner()
    const input = saveDraftInput.parse(raw)
    return await ownerTx(owner.userId, (tx) => writeDraft(tx, input))
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, error: 'This draft could not be saved: some fields are not valid.' }
    if (err instanceof Error && err.name === 'AuthError') return { ok: false, error: 'Signed out. Sign in again to keep saving.' }
    log('error', 'saveDraft failed', { requestId: await requestId(), postId: (raw as { postId?: string })?.postId }, err)
    return { ok: false, error: 'Could not reach the server.' }
  }
}

/* ---------------------------------------------------------------- Publish & status */

export async function publishPost(postId: string, notify: boolean) {
  return run(async () => {
    const owner = await requireOwner()
    const res = await publishCore(uuid.parse(postId), {
      notify,
      actorId: owner.userId,
      scope: { role: 'owner', userId: owner.userId },
    })
    const url = res.visibility === 'unlisted' ? null : `/blogs/${res.slug}`
    return { ok: true, url, emailed: !!res.campaignId }
  })
}

export async function schedulePost(postId: string, atIso: string, notify: boolean) {
  return run(async () => {
    const owner = await requireOwner()
    const id = uuid.parse(postId)
    const at = new Date(z.iso.datetime({ offset: true, local: true }).parse(atIso))
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 60_000) {
      return { ok: false, error: 'Pick a time at least a minute from now.' }
    }
    await ownerTx(owner.userId, async (tx) => {
      await tx
        .update(posts)
        .set({ status: 'scheduled', scheduledAt: at, notifyOnPublish: notify })
        .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
      await tx.insert(auditLog).values({ actorId: owner.userId, action: 'post.schedule', targetType: 'post', targetId: id, meta: { at: at.toISOString() } })
    })
    await enqueue({ name: 'post/scheduled', data: { postId: id, at: at.toISOString() } })
    return { ok: true, at: at.toISOString() }
  })
}

async function setStatus(postId: string, patch: Partial<typeof posts.$inferInsert>, action: string) {
  return run(async () => {
    const owner = await requireOwner()
    const id = uuid.parse(postId)
    await ownerTx(owner.userId, async (tx) => {
      await tx.update(posts).set(patch).where(eq(posts.id, id))
      await tx.insert(auditLog).values({ actorId: owner.userId, action, targetType: 'post', targetId: id })
    })
    invalidatePost(id)
    return { ok: true }
  })
}

export const unpublishPost = async (postId: string) =>
  setStatus(postId, { status: 'draft', scheduledAt: null }, 'post.unpublish')
export const archivePost = async (postId: string) => setStatus(postId, { status: 'archived' }, 'post.archive')
export const deletePost = async (postId: string) => setStatus(postId, { deletedAt: new Date() }, 'post.delete')

/** Bulk actions from the Posts table. */
export async function bulkUpdate(
  ids: string[],
  change: { visibility?: string; collectionId?: string; unpublish?: boolean; delete?: boolean },
) {
  return run(async () => {
    const owner = await requireOwner()
    const list = z.array(uuid).min(1).max(200).parse(ids)
    const patch: Partial<typeof posts.$inferInsert> = {}
    if (change.visibility) patch.visibility = visibilityEnum.parse(change.visibility)
    if (change.collectionId) patch.collectionId = uuid.parse(change.collectionId)
    if (change.unpublish) Object.assign(patch, { status: 'draft', scheduledAt: null })
    if (change.delete) patch.deletedAt = new Date()
    await ownerTx(owner.userId, async (tx) => {
      // Diary entries never become Public in bulk; that needs the one-by-one confirmation.
      const guard = patch.visibility === 'public' ? ne(posts.kind, 'diary') : undefined
      await tx.update(posts).set(patch).where(and(inArray(posts.id, list), guard))
      if (patch.visibility === 'unlisted') {
        const missing = await tx
          .select({ id: posts.id })
          .from(posts)
          .where(and(inArray(posts.id, list), isNull(posts.unlistedToken)))
        for (const m of missing) await tx.update(posts).set({ unlistedToken: unlistedToken() }).where(eq(posts.id, m.id))
      }
      await tx.insert(auditLog).values({ actorId: owner.userId, action: 'post.bulk', targetType: 'post', meta: { ids: list, change } })
    })
    list.forEach(invalidatePost)
    return { ok: true }
  })
}

/* ---------------------------------------------------------------- History */

export async function listRevisions(postId: string) {
  const owner = await requireOwner()
  const id = uuid.parse(postId)
  return ownerTx(owner.userId, (tx) =>
    tx
      .select({ id: postRevisions.id, version: postRevisions.version, reason: postRevisions.reason, createdAt: postRevisions.createdAt })
      .from(postRevisions)
      .where(eq(postRevisions.postId, id))
      .orderBy(desc(postRevisions.createdAt))
      .limit(30),
  )
}

export async function restoreRevision(postId: string, revisionId: string) {
  return run(async () => {
    const owner = await requireOwner()
    const id = uuid.parse(postId)
    const revId = uuid.parse(revisionId)
    return ownerTx(owner.userId, async (tx) => {
      const [rev] = await tx
        .select()
        .from(postRevisions)
        .where(and(eq(postRevisions.id, revId), eq(postRevisions.postId, id)))
      if (!rev) return { ok: false as const, error: 'That version no longer exists.' }
      const [updated] = await tx
        .update(posts)
        .set({ title: rev.title, draftJson: rev.contentJson, draftVersion: sql`${posts.draftVersion} + 1` })
        .where(eq(posts.id, id))
        .returning({ version: posts.draftVersion })
      await tx.insert(postRevisions).values({
        postId: id,
        version: updated!.version,
        title: rev.title,
        contentJson: rev.contentJson,
        reason: 'restore',
      })
      return { ok: true as const, version: updated!.version, title: rev.title, draftJson: rev.contentJson }
    })
  })
}

/* ---------------------------------------------------------------- Visibility & sharing */

export async function setVisibility(postId: string, mode: string, confirmDiaryPublic = false) {
  return run(async () => {
    const owner = await requireOwner()
    const id = uuid.parse(postId)
    const visibility = visibilityEnum.parse(mode)
    const result = await ownerTx(owner.userId, async (tx) => {
      const [post] = await tx.select({ kind: posts.kind, token: posts.unlistedToken }).from(posts).where(eq(posts.id, id))
      if (!post) return null
      if (post.kind === 'diary' && visibility === 'public' && !confirmDiaryPublic) return { needsConfirm: true as const }
      const token = visibility === 'unlisted' ? (post.token ?? unlistedToken()) : post.token
      await tx.update(posts).set({ visibility, unlistedToken: token }).where(eq(posts.id, id))
      await tx.insert(auditLog).values({ actorId: owner.userId, action: 'post.visibility', targetType: 'post', targetId: id, meta: { visibility } })
      return { token }
    })
    if (!result) return { ok: false, error: 'This post no longer exists.' }
    if ('needsConfirm' in result) {
      return { ok: true, needsConfirm: true, visibility: 'private', unlistedToken: null }
    }
    invalidatePost(id)
    return { ok: true, visibility, unlistedToken: result.token }
  })
}

export async function grantAccess(raw: z.input<typeof grantInput>) {
  return run(async () => {
    const owner = await requireOwner()
    const input = grantInput.parse(raw)
    if (input.scope === 'post' && !input.postId) return { ok: false, error: 'Pick the entry to share.' }
    const { grantId, title } = await ownerTx(owner.userId, async (tx) => {
      const existingUser = await tx.query.users.findFirst({ columns: { id: true }, where: eq(users.email, input.email) })
      const [g] = await tx
        .insert(accessGrants)
        .values({
          email: input.email,
          userId: existingUser?.id ?? null,
          scope: input.scope,
          postId: input.scope === 'post' ? input.postId! : null,
        })
        .returning({ id: accessGrants.id })
      await tx.insert(auditLog).values({ actorId: owner.userId, action: 'grant.create', targetType: 'access_grant', targetId: g!.id, meta: { scope: input.scope, postId: input.postId ?? null } })
      const post = input.postId ? await tx.query.posts.findFirst({ columns: { title: true }, where: eq(posts.id, input.postId) }) : null
      return { grantId: g!.id, title: post?.title }
    })
    // The invite is a magic link that signs them in and lands on what was shared.
    const invited = title ?? (input.scope === 'members' ? 'members-only posts' : 'shared diary entries')
    await auth.api
      .signInMagicLink({
        body: { email: input.email, callbackURL: input.postId ? `/read/${input.postId}` : '/blogs', metadata: { invited } },
        headers: await headers(),
      })
      .catch((err: unknown) => log('error', 'invite email failed', { grantId }, err))
    return { ok: true, id: grantId }
  })
}

export async function revokeAccess(grantId: string) {
  return run(async () => {
    const owner = await requireOwner()
    const id = uuid.parse(grantId)
    await ownerTx(owner.userId, async (tx) => {
      await tx.update(accessGrants).set({ revokedAt: new Date() }).where(eq(accessGrants.id, id))
      await tx.insert(auditLog).values({ actorId: owner.userId, action: 'grant.revoke', targetType: 'access_grant', targetId: id })
    })
    return { ok: true }
  })
}
