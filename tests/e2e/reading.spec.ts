import { expect, test } from '@playwright/test'

test('home, blog list and a post render; locked posts reveal nothing', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Coder thích chơi')
  await expect(page.getByRole('heading', { name: 'Latest writing' })).toBeVisible()

  await page.goto('/blogs')
  await expect(page.getByText('The math of a guitar fret').first()).toBeVisible()
  // Locked cards carry no title, only the mode and a redacted bar.
  await expect(page.getByText('Diary: 28 Oct')).toHaveCount(0)
  await expect(page.getByLabel('Hidden title').first()).toBeVisible()

  await page.getByText('The math of a guitar fret').first().click()
  await expect(page).toHaveURL(/\/blogs\/fret-math$/)
  await expect(page.locator('.katex-display')).toBeVisible()
  await expect(page.locator('.ct-code-pre')).toContainText('fret_distance')
  await expect(page.getByRole('navigation', { name: 'On this page' })).toContainText('Twelve equal steps')
})

test('private and members posts are not served to strangers', async ({ page, request }) => {
  const res = await page.goto('/blogs/diary-28-oct')
  await expect(page.getByText('Diary: 28 Oct')).toHaveCount(0)
  expect(res?.headers()['cache-control']).toContain('no-store')
  await page.goto('/blogs/tabs-vs-sheet-music')
  await expect(page.getByText('When each one wins')).toHaveCount(0)

  const rss = await (await request.get('/rss.xml')).text()
  expect(rss).toContain('The math of a guitar fret')
  for (const hidden of ['Diary: 28 Oct', 'Reading guitar tabs', 'Capo math']) expect(rss).not.toContain(hidden)

  // Public posts may mention the diary; locked entries themselves must never come back.
  const search = (await (await request.get('/api/search?q=diary')).json()) as { hits: { title: string; visibility: string }[] }
  expect(search.hits.every((h) => h.visibility === 'public')).toBe(true)
  expect(search.hits.map((h) => h.title)).not.toContain('Diary: 28 Oct')
})

test('the command line navigates', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' }) // the ":" listener attaches after hydration
  await page.keyboard.press(':')
  await page.getByLabel('Command', { exact: true }).fill('about')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/about$/)
})
