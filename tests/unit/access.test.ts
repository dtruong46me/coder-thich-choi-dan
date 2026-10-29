import { describe, expect, it } from 'vitest'
import { canEmail, canRead, isIndexable, type Grant, type PostAccess, type Viewer } from '@/lib/access-rules'

const post = (over: Partial<PostAccess> = {}): PostAccess => ({
  id: 'p1',
  kind: 'blog',
  status: 'published',
  visibility: 'public',
  deletedAt: null,
  unlistedToken: null,
  ...over,
})
const grant = (over: Partial<Grant>): Grant => ({ scope: 'post', postId: 'p1', expiresAt: null, revokedAt: null, ...over })

const anon: Viewer = { kind: 'anon' }
const owner: Viewer = { kind: 'owner', userId: 'u0', email: 'me@example.com' }
const reader = (over: Partial<Extract<Viewer, { kind: 'reader' }>> = {}): Viewer => ({
  kind: 'reader',
  userId: 'u1',
  email: 'lan@example.com',
  isMember: false,
  grants: [],
  ...over,
})

describe('canRead: Public', () => {
  it('everyone reads a published public post', () => {
    for (const v of [anon, reader(), owner]) expect(canRead(v, post())).toBe(true)
  })
  it('nobody but the owner reads a draft, a scheduled or an archived post', () => {
    for (const status of ['draft', 'scheduled', 'archived'] as const) {
      expect(canRead(anon, post({ status }))).toBe(false)
      expect(canRead(reader({ isMember: true }), post({ status }))).toBe(false)
      expect(canRead(owner, post({ status }))).toBe(true)
    }
  })
  it('a deleted post is gone for everyone but the owner', () => {
    expect(canRead(anon, post({ deletedAt: new Date() }))).toBe(false)
    expect(canRead(owner, post({ deletedAt: new Date() }))).toBe(true)
  })
})

describe('canRead: Unlisted', () => {
  const p = post({ visibility: 'unlisted', unlistedToken: 'a'.repeat(22) })
  it('needs the exact token from the link', () => {
    expect(canRead(anon, p)).toBe(false)
    expect(canRead(anon, p, { unlistedToken: 'b'.repeat(22) })).toBe(false)
    expect(canRead(anon, p, { unlistedToken: 'a'.repeat(22) })).toBe(true)
  })
  it('is not opened by being signed in', () => {
    expect(canRead(reader({ isMember: true }), p)).toBe(false)
  })
  it('a post without a token cannot be opened by an empty token', () => {
    expect(canRead(anon, post({ visibility: 'unlisted', unlistedToken: null }), { unlistedToken: '' })).toBe(false)
  })
})

describe('canRead: Members', () => {
  const p = post({ visibility: 'members' })
  it('strangers and non-members are locked out', () => {
    expect(canRead(anon, p)).toBe(false)
    expect(canRead(reader(), p)).toBe(false)
  })
  it('confirmed, signed-in subscribers read it', () => {
    expect(canRead(reader({ isMember: true }), p)).toBe(true)
  })
  it('a members grant also works, until revoked', () => {
    expect(canRead(reader({ grants: [grant({ scope: 'members', postId: null })] }), p)).toBe(true)
    expect(canRead(reader({ grants: [grant({ scope: 'members', postId: null, revokedAt: new Date() })] }), p)).toBe(false)
  })
})

describe('canRead: Shared', () => {
  const p = post({ id: 'p1', kind: 'diary', visibility: 'shared' })
  it('only people with a grant for this post', () => {
    expect(canRead(anon, p)).toBe(false)
    expect(canRead(reader({ isMember: true }), p)).toBe(false)
    expect(canRead(reader({ grants: [grant({ postId: 'p1' })] }), p)).toBe(true)
    expect(canRead(reader({ grants: [grant({ postId: 'other' })] }), p)).toBe(false)
  })
  it('all_shared_diary covers shared diary entries but not shared blog posts', () => {
    const g = [grant({ scope: 'all_shared_diary', postId: null })]
    expect(canRead(reader({ grants: g }), p)).toBe(true)
    expect(canRead(reader({ grants: g }), post({ visibility: 'shared', kind: 'blog' }))).toBe(false)
  })
  it('expired and revoked grants do nothing', () => {
    const now = new Date('2026-10-29T00:00:00Z')
    expect(canRead(reader({ grants: [grant({ expiresAt: new Date('2026-10-28T00:00:00Z') })] }), p, { now })).toBe(false)
    expect(canRead(reader({ grants: [grant({ expiresAt: new Date('2026-10-30T00:00:00Z') })] }), p, { now })).toBe(true)
    expect(canRead(reader({ grants: [grant({ revokedAt: new Date() })] }), p)).toBe(false)
  })
})

describe('canRead: Private', () => {
  const p = post({ kind: 'diary', visibility: 'private' })
  it('only the owner, whatever grants a reader holds', () => {
    expect(canRead(anon, p)).toBe(false)
    expect(
      canRead(
        reader({ isMember: true, grants: [grant({ postId: 'p1' }), grant({ scope: 'all_shared_diary', postId: null })] }),
        p,
      ),
    ).toBe(false)
    expect(canRead(owner, p)).toBe(true)
  })
})

describe('feeds and email', () => {
  it('only published public posts are indexable', () => {
    expect(isIndexable(post())).toBe(true)
    for (const visibility of ['unlisted', 'members', 'shared', 'private'] as const) expect(isIndexable(post({ visibility }))).toBe(false)
    expect(isIndexable(post({ status: 'draft' }))).toBe(false)
  })
  it('diary entries are never emailed, even when public', () => {
    expect(canEmail({ visibility: 'public', kind: 'blog' })).toBe(true)
    expect(canEmail({ visibility: 'public', kind: 'diary' })).toBe(false)
    expect(canEmail({ visibility: 'members', kind: 'blog' })).toBe(false)
  })
})
