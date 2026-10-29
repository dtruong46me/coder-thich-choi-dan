import 'server-only'
import { and, eq, gt } from 'drizzle-orm'
import { createElement } from 'react'
import ConfirmSubscription from '@/emails/ConfirmSubscription'
import { asSystem } from './db/client'
import { subscribers } from './db/schema'
import { sendEmail } from './email/send'
import { hashToken, randomToken } from './email/tokens'
import { absoluteUrl } from './site'

const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000

/**
 * Double opt-in, step 1. Always resolves the same way whether or not the email is already on the
 * list, so the form cannot be used to find out who subscribed.
 */
export async function requestSubscription(email: string, topics: string[]) {
  const token = randomToken()
  const send = await asSystem(async (tx) => {
    const existing = await tx.query.subscribers.findFirst({ where: eq(subscribers.email, email) })
    if (existing?.status === 'confirmed') {
      if (topics.length) await tx.update(subscribers).set({ topics }).where(eq(subscribers.id, existing.id))
      return false
    }
    if (existing) {
      await tx
        .update(subscribers)
        .set({ status: 'pending', topics, confirmTokenHash: hashToken(token), createdAt: new Date(), unsubscribedAt: null })
        .where(eq(subscribers.id, existing.id))
    } else {
      await tx.insert(subscribers).values({ email, topics, status: 'pending', confirmTokenHash: hashToken(token) })
    }
    return true
  })
  if (send) {
    await sendEmail({
      to: email,
      subject: 'Confirm your subscription',
      react: createElement(ConfirmSubscription, { url: absoluteUrl(`/api/subscribe/confirm?token=${token}`), topics }),
    })
  }
}

/** Step 2: the link from the email. Valid for 48 hours. */
export async function confirmSubscription(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return false
  return asSystem(async (tx) => {
    const res = await tx
      .update(subscribers)
      .set({ status: 'confirmed', confirmedAt: new Date(), confirmTokenHash: null })
      .where(
        and(
          eq(subscribers.confirmTokenHash, hashToken(token)),
          eq(subscribers.status, 'pending'),
          gt(subscribers.createdAt, new Date(Date.now() - CONFIRM_TTL_MS)),
        ),
      )
      .returning({ id: subscribers.id })
    return res.length > 0
  })
}

export async function unsubscribe(subscriberId: string) {
  await asSystem((tx) =>
    tx.update(subscribers).set({ status: 'unsubscribed', unsubscribedAt: new Date() }).where(eq(subscribers.id, subscriberId)),
  )
}
