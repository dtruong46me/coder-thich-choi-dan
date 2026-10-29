import { expect, test } from '@playwright/test'
import { OWNER_STATE } from './global-setup'

test.use({ storageState: OWNER_STATE })

test('write a post: autosave keeps structure, then publish', async ({ page }) => {
  await page.goto('/admin/posts')
  await page.locator('main').getByRole('button', { name: 'New post' }).click()
  await page.waitForURL(/\/admin\/editor\//)
  const title = `E2E post ${Date.now()}`
  await page.locator('#ttl').fill(title)
  await page.locator('.doc').click()
  await page.keyboard.type('## Section one')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Body text for the end-to-end test.')
  await expect(page.getByRole('status').filter({ hasText: /Draft saved at/ }).first()).toBeVisible({ timeout: 10_000 })

  // Reload: the heading must still be a heading (attrs survive the save).
  await page.reload()
  await expect(page.locator('.doc h2')).toHaveText('Section one')

  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.locator('.ed-notice').first()).toContainText('Published')
  await page.goto('/blogs')
  await expect(page.getByText(title)).toBeVisible()
})

test('a shared diary page opens for the invited reader only', async ({ page, browser, baseURL }) => {
  // Find the seeded shared entry and invite a reader.
  await page.goto('/admin/manage?tab=sharing')
  const email = `friend-${Date.now()}@example.com`
  await page.getByLabel('EMAIL').fill(email)
  await page.getByLabel('CAN READ').selectOption('post')
  await page.getByRole('button', { name: 'Send invite' }).click()
  await expect(page.getByRole('status')).toContainText('Invite sent')

  const { linkFromMail } = await import('./mail')
  const link = await linkFromMail(email, /https?:\/\/\S+\/api\/auth\/magic-link\/verify\?\S+/)

  // Contexts created in a test inherit `use` options (the owner session), so clear it explicitly.
  const empty = { cookies: [], origins: [] }
  const stranger = await (await browser.newContext({ baseURL, storageState: empty })).newPage()
  await stranger.goto('/blogs', { waitUntil: 'networkidle' })
  await stranger.getByLabel('Hidden title').first().click()
  await expect(stranger.getByRole('heading', { name: /Locked/ })).toBeVisible({ timeout: 10_000 })

  const friend = await (await browser.newContext({ baseURL, storageState: empty })).newPage()
  await friend.goto(link)
  await expect(friend).toHaveURL(/\/blogs\//)
  await expect(friend.getByRole('heading', { level: 1 })).toContainText('Diary: first month in Japan')
})
