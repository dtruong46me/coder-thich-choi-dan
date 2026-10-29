import 'server-only'
import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { magicLink } from 'better-auth/plugins'
import { createElement } from 'react'
import { v7 as uuidv7 } from 'uuid'
import MagicLink from '@/emails/MagicLink'
import { db } from './db/client'
import * as schema from './db/schema'
import { sendEmail } from './email/send'
import { hashToken } from './email/tokens'
import { rateLimit } from './rate-limit'
import { SITE } from './site'

const DAY = 60 * 60 * 24
const ownerEmail = () => (process.env.OWNER_EMAIL ?? '').trim().toLowerCase()
const isOwnerEmail = (email: string | undefined | null) => !!email && email.toLowerCase() === ownerEmail()

export const auth = betterAuth({
  appName: SITE.name,
  baseURL: process.env.BETTER_AUTH_URL ?? SITE.url,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  advanced: {
    database: { generateId: () => uuidv7() },
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
  },
  user: {
    additionalFields: { role: { type: 'string', required: false, defaultValue: 'reader', input: false } },
    // GitHub is only a fallback door for the owner. Everyone else signs in with a magic link.
    validateUserInfo: ({ user, source }) => {
      if (source.method === 'oauth' && !isOwnerEmail(user.email)) {
        return { error: 'owner_only', message: 'GitHub sign-in is for the site owner.' }
      }
    },
  },
  session: {
    expiresIn: 30 * DAY, // readers; the owner's sessions are shortened to 7 days below
    updateAge: DAY,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: { ...user, role: isOwnerEmail(user.email) ? 'owner' : 'reader' } }),
      },
    },
    session: {
      create: {
        before: async (session) => {
          const owner = await db.query.users.findFirst({
            columns: { role: true },
            where: (u, { eq }) => eq(u.id, session.userId),
          })
          if (owner?.role === 'owner') {
            return { data: { ...session, expiresAt: new Date(Date.now() + 7 * DAY * 1000) } }
          }
        },
      },
    },
  },
  socialProviders: process.env.GITHUB_CLIENT_ID
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
          disableImplicitSignUp: false,
        },
      }
    : undefined,
  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      rateLimit: { window: 15 * 60, max: 5 },
      sendMagicLink: async ({ email, url, metadata }) => {
        // 5 links per 15 minutes per email; extra requests are dropped silently.
        if (!(await rateLimit('magicLink', hashToken(email.toLowerCase())))) return
        const invited = typeof metadata?.invited === 'string' ? metadata.invited : undefined
        await sendEmail({
          to: email,
          subject: invited ? 'Đình Trường shared something with you' : 'Your sign-in link',
          react: createElement(MagicLink, { url, invited }),
        })
      },
    }),
    passkey({
      rpID: new URL(SITE.url).hostname,
      rpName: SITE.name,
      origin: SITE.url,
    }),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
