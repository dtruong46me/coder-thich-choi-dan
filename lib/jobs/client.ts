import 'server-only'
import { Inngest } from 'inngest'
import { log } from '../log'

export const inngest = new Inngest({ id: 'coderthichchoidan' })

export type JobEvent =
  | { name: 'post/published'; data: { postId: string; slug: string } }
  | { name: 'post/scheduled'; data: { postId: string; at: string } }
  | { name: 'email/campaign.created'; data: { campaignId: string } }

/**
 * Hands slow or flaky work to the job queue so the request that triggered it returns at once.
 * Without Inngest configured (local dev without the Inngest dev server), the task runs in-process instead.
 */
export async function enqueue(event: JobEvent): Promise<void> {
  if (process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV) {
    await inngest.send(event)
    return
  }
  const { runInline } = await import('./tasks')
  void runInline(event).catch((err) => log('error', 'inline job failed', { job: event.name }, err))
}
