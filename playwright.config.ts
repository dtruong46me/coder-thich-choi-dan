import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3000)
export const MAIL_DIR = process.env.E2E_MAIL_DIR ?? 'test-results/mail'
// Use a preinstalled Chromium when the matching Playwright browser is not downloaded (e.g. sandboxes).
export const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}

// Needs a migrated + seeded database and a production build (npm run build). CI does both.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', launchOptions },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { E2E_MAIL_DIR: MAIL_DIR },
    timeout: 120_000,
  },
})
