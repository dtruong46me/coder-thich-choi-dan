import { inArray } from 'drizzle-orm'
import { asSystem } from '@/lib/db/client'
import { subscribers } from '@/lib/db/schema'
import { verifyResendWebhook } from '@/lib/email/webhook'

type ResendEvent = { type: string; data?: { to?: string[] | string } }

/** Bounces and spam complaints mark the subscriber as bounced, so later campaigns skip them. */
export async function POST(req: Request) {
  const body = await req.text()
  if (!verifyResendWebhook(body, req.headers)) return new Response('Invalid signature', { status: 401 })
  const event = JSON.parse(body) as ResendEvent
  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    const to = Array.isArray(event.data?.to) ? event.data.to : event.data?.to ? [event.data.to] : []
    if (to.length) {
      await asSystem((tx) =>
        tx
          .update(subscribers)
          .set({ status: 'bounced' })
          .where(inArray(subscribers.email, to.map((e) => e.toLowerCase()))),
      )
    }
  }
  return Response.json({ ok: true })
}
