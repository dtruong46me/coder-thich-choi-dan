// Runs against a real, migrated Postgres when TEST_DATABASE_URL is set (CI does this). Skipped otherwise.
// Connect as the app role (not the table owner) so Row-Level Security is actually exercised.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('database', () => {
  let m: {
    client: typeof import('@/lib/db/client')
    schema: typeof import('@/lib/db/schema')
    drafts: typeof import('@/lib/drafts')
    search: typeof import('@/lib/search')
    orm: typeof import('drizzle-orm')
  }
  const ids: string[] = []

  beforeAll(async () => {
    process.env.DATABASE_URL = url
    m = {
      client: await import('@/lib/db/client'),
      schema: await import('@/lib/db/schema'),
      drafts: await import('@/lib/drafts'),
      search: await import('@/lib/search'),
      orm: await import('drizzle-orm'),
    }
  })

  afterAll(async () => {
    if (!m) return
    const { asSystem } = m.client
    const { posts } = m.schema
    await asSystem((tx) => tx.delete(posts).where(m.orm.inArray(posts.id, ids)))
  })

  async function makePost(over: Partial<typeof m.schema.posts.$inferInsert> = {}) {
    const { asSystem } = m.client
    const { posts } = m.schema
    const slug = `test-${Math.random().toString(36).slice(2, 10)}`
    const [row] = await asSystem((tx) =>
      tx
        .insert(posts)
        .values({ slug, title: 'Test post', status: 'published', visibility: 'public', publishedAt: new Date(), ...over })
        .returning(),
    )
    ids.push(row!.id)
    return row!
  }

  it('autosave never overwrites a newer version (409 conflict)', async () => {
    const post = await makePost({ status: 'draft' })
    const owner = { role: 'owner' as const, userId: '00000000-0000-7000-8000-000000000000' }
    const doc = (text: string) => ({ type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
    const save = (baseVersion: number, text: string) =>
      m.client.withScope(owner, (tx) => m.drafts.writeDraft(tx, { postId: post.id, baseVersion, title: text, draftJson: doc(text), reason: 'autosave' }))

    const laptop = await save(0, 'from laptop')
    expect(laptop).toMatchObject({ ok: true, version: 1 })
    const phone = await save(0, 'from phone') // still thinks it is on version 0
    expect(phone.ok).toBe(false)
    if (!phone.ok) {
      expect(phone.conflict?.version).toBe(1)
      expect(phone.conflict?.title).toBe('from laptop')
    }
    const again = await save(1, 'phone after picking a side')
    expect(again).toMatchObject({ ok: true, version: 2 })

    // Both sides of the conflict are kept in History.
    const revs = await m.client.withScope(owner, (tx) =>
      tx.select({ title: m.schema.postRevisions.title }).from(m.schema.postRevisions).where(m.orm.eq(m.schema.postRevisions.postId, post.id)),
    )
    expect(revs.map((r) => r.title)).toEqual(expect.arrayContaining(['from laptop', 'from phone']))
  })

  it('RLS: strangers only ever get public rows; locked stubs carry no title', async () => {
    const priv = await makePost({ kind: 'diary', visibility: 'private', title: 'Secret diary' })
    const shared = await makePost({ kind: 'diary', visibility: 'shared', title: 'Shared diary' })
    const { posts, accessGrants } = m.schema
    const { eq, sql } = m.orm

    const anonRows = await m.client.asAnon((tx) => tx.select({ id: posts.id }).from(posts).where(m.orm.inArray(posts.id, [priv.id, shared.id])))
    expect(anonRows).toEqual([])

    const stubs = await m.client.asAnon((tx) => tx.execute(sql`select * from locked_post_stubs() where id = ${priv.id}`))
    expect([...stubs][0]).not.toHaveProperty('title')

    await m.client.asSystem((tx) => tx.insert(accessGrants).values({ email: 'lan@example.com', scope: 'post', postId: shared.id }))
    const lan = { role: 'reader' as const, userId: '00000000-0000-7000-8000-0000000000aa', email: 'LAN@example.com', member: false }
    const lanRows = await m.client.withScope(lan, (tx) => tx.select({ id: posts.id }).from(posts).where(m.orm.inArray(posts.id, [priv.id, shared.id])))
    expect(lanRows.map((r) => r.id)).toEqual([shared.id])

    // Strangers cannot write, even if a query tries.
    const updated = await m.client.asAnon((tx) => tx.update(posts).set({ title: 'hacked' }).where(eq(posts.id, priv.id)).returning())
    expect(updated).toEqual([])
  })

  it('search ignores accents and tolerates typos, and never shows locked posts to strangers', async () => {
    const { sql } = m.orm
    const pub = await makePost({ title: 'Học đàn piano ở Bách Khoa', excerpt: 'Hiragana practice', visibility: 'public' })
    await m.client.asSystem((tx) =>
      tx.execute(sql`update posts set search_vector = post_search_vector(title, excerpt, 'body') where id = ${pub.id}`),
    )
    const priv = await makePost({ title: 'Đàn riêng tư', visibility: 'private' })
    await m.client.asSystem((tx) =>
      tx.execute(sql`update posts set search_vector = post_search_vector(title, excerpt, 'body') where id = ${priv.id}`),
    )
    const anon = { kind: 'anon' as const }
    const hits = await m.search.searchPosts(anon, 'dan')
    expect(hits.map((h) => h.id)).toContain(pub.id)
    expect(hits.map((h) => h.id)).not.toContain(priv.id)
    const typo = await m.search.searchPosts(anon, 'bach khao')
    expect(typo.map((h) => h.id)).toContain(pub.id)
  })
})
