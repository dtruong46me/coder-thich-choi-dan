'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { createElement } from 'react'
import { z } from 'zod'
import NewPost from '@/emails/NewPost'
import { requireOwner } from '../access'
import { TAGS } from '../cache-tags'
import { exportSubscribersCsv } from '../db/queries/admin'
import { withScope, type Tx } from '../db/client'
import { auditLog, collections, posts, projects, sessions, siteSettings, subscribers } from '../db/schema'
import { sendEmail } from '../email/send'
import { absoluteUrl } from '../site'
import { collectionInput, projectInput, settingsInput, uuid } from '../validation'
import { run } from './result'

async function asOwner<T>(fn: (tx: Tx, userId: string) => Promise<T>) {
  const owner = await requireOwner()
  return withScope({ role: 'owner', userId: owner.userId }, (tx) => fn(tx, owner.userId))
}
const expire = (...tags: string[]) => tags.forEach((t) => revalidateTag(t, { expire: 0 }))

/* ---------------------------------------------------------------- Collections */

export async function saveCollection(raw: z.input<typeof collectionInput>) {
  return run(async () => {
    const input = collectionInput.parse(raw)
    await asOwner(async (tx) => {
      if (input.id) await tx.update(collections).set(input).where(eq(collections.id, input.id))
      else {
        const all = await tx.select({ id: collections.id }).from(collections)
        await tx.insert(collections).values({ ...input, position: all.length })
      }
    })
    expire(TAGS.collections, TAGS.posts)
    return { ok: true }
  })
}

export async function reorderCollections(ids: string[]) {
  return run(async () => {
    const list = z.array(uuid).max(100).parse(ids)
    await asOwner(async (tx) => {
      for (const [i, id] of list.entries()) await tx.update(collections).set({ position: i }).where(eq(collections.id, id))
    })
    expire(TAGS.collections)
    return { ok: true }
  })
}

/* ---------------------------------------------------------------- Projects */

export async function saveProject(raw: z.input<typeof projectInput>) {
  return run(async () => {
    const input = projectInput.parse(raw)
    await asOwner(async (tx) => {
      if (input.id) await tx.update(projects).set(input).where(eq(projects.id, input.id))
      else {
        const all = await tx.select({ id: projects.id }).from(projects)
        await tx.insert(projects).values({ ...input, position: all.length })
      }
    })
    expire(TAGS.projects)
    return { ok: true }
  })
}

export async function setProjectFeatured(id: string, featured: boolean) {
  return run(async () => {
    await asOwner((tx) => tx.update(projects).set({ featured }).where(eq(projects.id, uuid.parse(id))))
    expire(TAGS.projects)
    return { ok: true }
  })
}

export async function reorderProjects(ids: string[]) {
  return run(async () => {
    const list = z.array(uuid).max(100).parse(ids)
    await asOwner(async (tx) => {
      for (const [i, id] of list.entries()) await tx.update(projects).set({ position: i }).where(eq(projects.id, id))
    })
    expire(TAGS.projects)
    return { ok: true }
  })
}

export async function deleteProject(id: string) {
  return run(async () => {
    await asOwner((tx) => tx.delete(projects).where(eq(projects.id, uuid.parse(id))))
    expire(TAGS.projects)
    return { ok: true }
  })
}

/* ---------------------------------------------------------------- Subscribers */

export async function exportSubscribers() {
  return run(async () => {
    const owner = await requireOwner()
    return { ok: true, csv: await exportSubscribersCsv(owner.userId) }
  })
}

export async function removeSubscribers(ids: string[]) {
  return run(async () => {
    const list = z.array(uuid).min(1).max(500).parse(ids)
    await asOwner(async (tx, userId) => {
      await tx.delete(subscribers).where(inArray(subscribers.id, list))
      await tx.insert(auditLog).values({ actorId: userId, action: 'subscriber.remove', targetType: 'subscriber', meta: { count: list.length } })
    })
    return { ok: true }
  })
}

/** Sends the new-post email for one post to the owner only, to check how it looks. */
export async function sendTestEmail(postId?: string) {
  return run(async () => {
    const owner = await requireOwner()
    const post = postId
      ? await withScope({ role: 'owner', userId: owner.userId }, (tx) =>
          tx.query.posts.findFirst({ where: eq(posts.id, uuid.parse(postId)) }),
        )
      : null
    await sendEmail({
      to: owner.email,
      subject: `[Test] ${post?.title || 'New post'}`,
      react: createElement(NewPost, {
        title: post?.title || 'The math of a guitar fret',
        excerpt: post?.excerpt || 'This is what subscribers will see when a post goes live.',
        url: absoluteUrl(post ? `/blogs/${post.slug}` : '/blogs'),
        collection: 'Test',
        unsubscribeUrl: absoluteUrl('/'),
      }),
    })
    return { ok: true }
  })
}

/* ---------------------------------------------------------------- Settings & sessions */

export async function updateSettings(raw: z.input<typeof settingsInput>) {
  return run(async () => {
    const input = settingsInput.parse(raw)
    await asOwner(async (tx, userId) => {
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue
        await tx
          .insert(siteSettings)
          .values({ key, value })
          .onConflictDoUpdate({ target: siteSettings.key, set: { value } })
      }
      await tx.insert(auditLog).values({ actorId: userId, action: 'settings.update', targetType: 'site_settings', meta: { keys: Object.keys(input) } })
    })
    expire(TAGS.settings)
    return { ok: true }
  })
}

/** "Sign out everywhere": drops every session of the owner, including this one. */
export async function signOutEverywhere() {
  return run(async () => {
    await asOwner(async (tx, userId) => {
      await tx.delete(sessions).where(eq(sessions.userId, userId))
      await tx.insert(auditLog).values({ actorId: userId, action: 'auth.sign_out_all', targetType: 'user', targetId: userId })
    })
    return { ok: true }
  })
}
