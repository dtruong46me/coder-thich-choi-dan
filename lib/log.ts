import 'server-only'

type Level = 'info' | 'warn' | 'error'
const SECRET_KEYS = /email|token|secret|password|cookie|authorization|content|draft|html/i

function scrub(fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) out[k] = SECRET_KEYS.test(k) ? '[redacted]' : v
  return out
}

/**
 * One JSON object per line, with a request id when there is one. Never pass emails, tokens or
 * post content: keys that look like them are redacted anyway.
 */
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}, err?: unknown) {
  const line = {
    level,
    msg,
    time: new Date().toISOString(),
    ...scrub(fields),
    ...(err instanceof Error ? { error: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 5).join('\n') } : {}),
  }
  const out = JSON.stringify(line)
  if (level === 'error') console.error(out)
  else if (level === 'warn') console.warn(out)
  else console.info(out)
}

export async function requestId(): Promise<string | undefined> {
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    return h.get('x-vercel-id') ?? h.get('x-request-id') ?? undefined
  } catch {
    return undefined
  }
}
