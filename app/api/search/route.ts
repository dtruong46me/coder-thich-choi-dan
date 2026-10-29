import type { NextRequest } from 'next/server'
import { getViewer } from '@/lib/access'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { searchPosts } from '@/lib/search'

/** 30 requests a minute per IP. Strangers only ever search Public posts. */
export async function GET(req: NextRequest) {
  if (!(await rateLimit('search', clientIp(req.headers)))) {
    return Response.json({ error: 'Too many searches. Slow down a little.' }, { status: 429 })
  }
  const q = req.nextUrl.searchParams.get('q') ?? ''
  const viewer = await getViewer()
  const hits = await searchPosts(viewer, q)
  return Response.json(
    { hits, owner: viewer.kind === 'owner' },
    { headers: { 'cache-control': viewer.kind === 'anon' ? 'public, max-age=60' : 'private, no-store', vary: 'cookie' } },
  )
}
