import { expect, test } from '@playwright/test'
import { linkFromMail } from './mail'

test('double opt-in: subscribe, confirm by email', async ({ page }) => {
  const email = `reader-${Date.now()}@example.com`
  const since = Date.now()
  await page.goto('/')
  const band = page.locator('#subscribe')
  await band.getByLabel('Email address').fill(email)
  await band.getByRole('button', { name: 'Subscribe' }).click()
  await expect(band.getByRole('status')).toContainText('Check your inbox')

  await page.goto(await linkFromMail(email, /https?:\/\/\S+\/api\/subscribe\/confirm\?token=\S+/, since))
  await expect(page).toHaveURL(/status=ok/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('You’re in.')
})
