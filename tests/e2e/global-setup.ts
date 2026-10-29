import { chromium, type FullConfig } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { launchOptions } from '../../playwright.config'
import { linkFromMail } from './mail'

export const OWNER_STATE = 'test-results/.auth/owner.json'
export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'owner@example.com'

/** Signs the owner in once through the real magic-link flow and saves the session for the editor tests. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!
  await mkdir('test-results/.auth', { recursive: true })
  const browser = await chromium.launch(launchOptions)
  const page = await browser.newPage({ baseURL })
  const since = Date.now()
  await page.goto('/sign-in?next=/admin')
  await page.getByLabel('Or get a link by email').fill(OWNER_EMAIL)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await page.getByText('Check your inbox').waitFor()
  await page.goto(await linkFromMail(OWNER_EMAIL, /https?:\/\/\S+\/api\/auth\/magic-link\/verify\?\S+/, since))
  await page.waitForURL('**/admin')
  await page.context().storageState({ path: OWNER_STATE })
  await browser.close()
}
