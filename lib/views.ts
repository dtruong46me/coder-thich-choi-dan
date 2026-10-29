import 'server-only'
import { redis } from './redis'

const mem = new Map<string, number>()

/** Dev-only fallback store when Redis is not configured. */
export const memoryViews = {
  drain(): [string, number][] {
    const out = [...mem.entries()]
    mem.clear()
    return out
  },
}

/** One view, counted in Redis. Written to Postgres every 10 minutes by the views-flush job. */
export async function countView(postId: string) {
  const day = new Date().toISOString().slice(0, 10)
  if (redis) {
    const key = `views:${postId}:${day}`
    await redis.incr(key)
    await redis.expire(key, 60 * 60 * 24 * 3)
  } else {
    const key = `${postId}:${day}`
    mem.set(key, (mem.get(key) ?? 0) + 1)
  }
}
