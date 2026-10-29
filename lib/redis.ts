import 'server-only'
import { Redis } from '@upstash/redis'

/** Upstash Redis when configured; otherwise null and callers fall back to in-memory (dev only). */
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null
