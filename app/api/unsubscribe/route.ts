import type { NextRequest } from 'next/server'
import { verifyUnsubscribe } from '@/lib/email/tokens'
import { unsubscribe } from '@/lib/subscribe'

// GET: the link in the footer of every email. POST: RFC 8058 one-click (List-Unsubscribe-Post), sent by Gmail/Yahoo.
export async function GET(req: NextRequest) {
  const id = verifyUnsubscribe(req.nextUrl.searchParams.get('token') ?? '')
  if (id) await unsubscribe(id)
  return Response.redirect(new URL(`/subscribed?status=${id ? 'unsubscribed' : 'invalid'}`, req.url), 303)
}

export async function POST(req: NextRequest) {
  const id = verifyUnsubscribe(req.nextUrl.searchParams.get('token') ?? '')
  if (!id) return new Response('Invalid token', { status: 400 })
  await unsubscribe(id)
  return new Response(null, { status: 200 })
}
