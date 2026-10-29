import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { Grant, Viewer } from './access-rules'
import { ANON } from './access-rules'
import { auth } from './auth'
import { db, type DbScope } from './db/client'
import { getSettings } from './db/queries/public'
import { accessGrants, subscribers } from './db/schema'

export * from './access-rules'

export class AuthError extends Error {
  constructor(message = 'Not allowed') {
    super(message)
    this.name = 'AuthError'
  }
}

const ownerEmail = () => (process.env.OWNER_EMAIL ?? '').trim().toLowerCase()

/** Reads the session once per request and turns it into a Viewer. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return ANON
  const { user } = session
  const email = user.email.toLowerCase()
  if ((user as { role?: string }).role === 'owner' && email === ownerEmail()) {
    return { kind: 'owner', userId: user.id, email }
  }
  const [grantRows, sub, settings] = await Promise.all([
    db
      .select({
        scope: accessGrants.scope,
        postId: accessGrants.postId,
        expiresAt: accessGrants.expiresAt,
        revokedAt: accessGrants.revokedAt,
      })
      .from(accessGrants)
      .where(and(eq(accessGrants.email, email), isNull(accessGrants.revokedAt))),
    db.query.subscribers.findFirst({
      columns: { status: true },
      where: and(eq(subscribers.email, email), eq(subscribers.status, 'confirmed')),
    }),
    getSettings(),
  ])
  // "Let visitors sign up as Members" off: confirmed subscribers still get email, but Members posts need a grant.
  const isMember = !!sub && settings.membersSignup !== false
  return { kind: 'reader', userId: user.id, email, isMember, grants: grantRows as Grant[] }
})

export function scopeFor(viewer: Viewer): DbScope {
  if (viewer.kind === 'owner') return { role: 'owner', userId: viewer.userId }
  if (viewer.kind === 'reader')
    return { role: 'reader', userId: viewer.userId, email: viewer.email, member: viewer.isMember }
  return { role: 'anon' }
}

/** First line of every admin server action and route. Middleware alone is not enough. */
export async function requireOwner(): Promise<Extract<Viewer, { kind: 'owner' }>> {
  const viewer = await getViewer()
  if (viewer.kind !== 'owner') throw new AuthError('Owner only')
  return viewer
}

/** Same check for admin pages: send strangers to the sign-in page instead of throwing. */
export async function requireOwnerPage(): Promise<Extract<Viewer, { kind: 'owner' }>> {
  const viewer = await getViewer()
  if (viewer.kind !== 'owner') redirect('/sign-in?next=/admin')
  return viewer
}
