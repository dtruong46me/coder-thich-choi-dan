import 'server-only'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> }

// prepare: false keeps us compatible with transaction-mode poolers (Neon/Supabase).
const client =
  globalForDb.pg ??
  postgres(process.env.DATABASE_URL ?? 'postgres://localhost:5432/ctcd', {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    prepare: false,
    idle_timeout: 20,
  })
if (process.env.NODE_ENV !== 'production') globalForDb.pg = client

export const db = drizzle(client, { schema })
export type Db = typeof db
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Who a query runs as. Row-Level Security policies on posts and post_revisions read these
 * settings (see drizzle/0001_rls_search.sql), so a bug in a query cannot leak a private post.
 * `system` is for background jobs; `owner` for the admin.
 */
export type DbScope =
  | { role: 'anon'; unlistedToken?: string }
  | { role: 'reader'; userId: string; email: string; member: boolean }
  | { role: 'owner'; userId: string }
  | { role: 'system' }

export async function withScope<T>(scope: DbScope, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const userId = 'userId' in scope ? scope.userId : ''
    const email = scope.role === 'reader' ? scope.email : ''
    const member = scope.role === 'reader' && scope.member ? 'on' : 'off'
    const token = scope.role === 'anon' ? (scope.unlistedToken ?? '') : ''
    await tx.execute(
      sql`select set_config('app.role', ${scope.role}, true), set_config('app.user_id', ${userId}, true),
                 set_config('app.email', ${email}, true), set_config('app.member', ${member}, true),
                 set_config('app.unlisted_token', ${token}, true)`,
    )
    return fn(tx)
  })
}

export const asAnon = <T>(fn: (tx: Tx) => Promise<T>) => withScope({ role: 'anon' }, fn)
export const asSystem = <T>(fn: (tx: Tx) => Promise<T>) => withScope({ role: 'system' }, fn)
