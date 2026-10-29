import { sql } from 'drizzle-orm'
import { connection } from 'next/server'
import { db } from '@/lib/db/client'

/** For the uptime check: 200 when the database answers, 503 otherwise. */
export async function GET() {
  await connection()
  const started = performance.now()
  try {
    await db.execute(sql`select 1`)
    return Response.json({ ok: true, db: 'ok', ms: Math.round(performance.now() - started) }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return Response.json({ ok: false, db: 'down' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}
