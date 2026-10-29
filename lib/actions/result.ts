import 'server-only'
import { z } from 'zod'
import { AuthError } from '../access'
import { log, requestId } from '../log'
import { PublishError } from '../publish'

export type ActionError = { ok: false; error: string; issues?: string[] }
export type ActionResult<T = object> = ({ ok: true } & T) | ActionError

/** Turns thrown auth, validation and publish errors into a plain result the client can show. */
export async function run<R extends { ok: boolean }>(fn: () => Promise<R>): Promise<R | ActionError> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'You need to be signed in as the owner.' }
    if (err instanceof z.ZodError) return { ok: false, error: 'Some fields are not valid.', issues: err.issues.map((i) => i.message) }
    if (err instanceof PublishError) return { ok: false, error: 'Not ready to publish yet.', issues: err.issues }
    // Next.js control flow (redirect, notFound) must keep propagating.
    if (err && typeof err === 'object' && 'digest' in err) throw err
    log('error', 'server action failed', { requestId: await requestId() }, err)
    return { ok: false, error: 'Something went wrong. Your draft is still saved on this device.' }
  }
}
