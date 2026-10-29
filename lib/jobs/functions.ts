import 'server-only'
import { inngest } from './client'
import { cleanupRevisions, flushViews, publishScheduled, sendCampaignBatch, warmOgImage } from './tasks'

export const publishFanout = inngest.createFunction(
  { id: 'publish-fanout', triggers: [{ event: 'post/published' }], retries: 3 },
  async ({ event, step }) => {
    await step.run('warm-og-image', () => warmOgImage(event.data.slug as string))
  },
)

export const sendCampaign = inngest.createFunction(
  {
    id: 'send-campaign',
    triggers: [{ event: 'email/campaign.created' }],
    retries: 5,
    concurrency: { limit: 1, key: 'event.data.campaignId' },
  },
  async ({ event, step }) => {
    const campaignId = event.data.campaignId as string
    let total = 0
    for (let i = 0; ; i++) {
      const sent = await step.run(`batch-${i}`, () => sendCampaignBatch(campaignId))
      total += sent
      if (sent === 0) break
    }
    return { total }
  },
)

export const scheduledPublish = inngest.createFunction(
  { id: 'scheduled-publish', triggers: [{ event: 'post/scheduled' }], retries: 5 },
  async ({ event, step }) => {
    await step.sleepUntil('wait-until-scheduled', event.data.at as string)
    return step.run('publish', () => publishScheduled(event.data.postId as string))
  },
)

export const revisionCleanup = inngest.createFunction(
  { id: 'revision-cleanup', triggers: [{ cron: 'TZ=Asia/Tokyo 0 4 * * *' }] },
  async ({ step }) => step.run('thin-revisions', () => cleanupRevisions()),
)

export const viewsFlush = inngest.createFunction(
  { id: 'views-flush', triggers: [{ cron: '*/10 * * * *' }] },
  async ({ step }) => step.run('flush', () => flushViews()),
)

export const functions = [publishFanout, sendCampaign, scheduledPublish, revisionCleanup, viewsFlush]
