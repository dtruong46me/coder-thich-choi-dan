import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

type Window = `${number} ${'s' | 'm'}`
const LIMITS = {
  subscribe: { tokens: 5, window: '1 m' },
  search: { tokens: 30, window: '1 m' },
  magicLink: { tokens: 5, window: '15 m' },
  views: { tokens: 60, window: '1 m' },
} satisfies Record<string, { tokens: number; window: Window }>

export type LimitName = keyof typeof LIMITS

const limiters = new Map<LimitName, Ratelimit>()
const memory = new Map<string, { count: number; reset: number }>()

function windowMs(w: Window) {
  const [n, unit] = w.split(' ') as [string, 's' | 'm']
  return Number(n) * (unit === 'm' ? 60_000 : 1_000)
}

/** Returns true when the call is allowed. `key` is an IP or an email hash, never a raw email in logs. */
export async function rateLimit(name: LimitName, key: string): Promise<boolean> {
  const cfg = LIMITS[name]
  if (redis) {
    let rl = limiters.get(name)
    if (!rl) {
      rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(cfg.tokens, cfg.window), prefix: `rl:${name}` })
      limiters.set(name, rl)
    }
    return (await rl.limit(key)).success
  }
  const now = Date.now()
  const k = `${name}:${key}`
  const cur = memory.get(k)
  if (!cur || cur.reset < now) {
    memory.set(k, { count: 1, reset: now + windowMs(cfg.window) })
    return true
  }
  cur.count++
  return cur.count <= cfg.tokens
}

export function clientIp(headers: Headers): string {
  return headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}
