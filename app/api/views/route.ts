import { z } from 'zod'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { countView } from '@/lib/views'

/** sendBeacon target from post pages. Counts go to Redis and reach Postgres every 10 minutes. */
export async function POST(req: Request) {
  if (!(await rateLimit('views', clientIp(req.headers)))) return new Response(null, { status: 204 })
  const parsed = z.object({ postId: z.uuid() }).safeParse(await req.json().catch(() => null))
  if (parsed.success) await countView(parsed.data.postId)
  return new Response(null, { status: 204 })
}
