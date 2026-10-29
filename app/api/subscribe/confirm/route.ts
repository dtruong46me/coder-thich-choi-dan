import type { NextRequest } from 'next/server'
import { confirmSubscription } from '@/lib/subscribe'

export async function GET(req: NextRequest) {
  const ok = await confirmSubscription(req.nextUrl.searchParams.get('token') ?? '')
  return Response.redirect(new URL(`/subscribed?status=${ok ? 'ok' : 'expired'}`, req.url), 303)
}
