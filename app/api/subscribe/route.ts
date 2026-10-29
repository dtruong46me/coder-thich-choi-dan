import { sameOrigin } from '@/lib/origin'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { requestSubscription } from '@/lib/subscribe'
import { verifyTurnstile } from '@/lib/turnstile'
import { subscribeInput } from '@/lib/validation'

/** 5 a minute per IP, Turnstile and a honeypot. Answers 202 whether or not the email was already subscribed. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Bad origin' }, { status: 403 })
  const ip = clientIp(req.headers)
  if (!(await rateLimit('subscribe', ip))) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const parsed = subscribeInput.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Check the email address.' }, { status: 400 })
  const { email, topics, website, turnstileToken } = parsed.data
  // Bots fill the hidden field. Pretend it worked.
  if (website) return new Response(null, { status: 202 })
  if (!(await verifyTurnstile(turnstileToken, ip))) return Response.json({ error: 'Bot check failed' }, { status: 400 })

  await requestSubscription(email, topics)
  return new Response(null, { status: 202 })
}
