import { readdir, readFile } from 'node:fs/promises'
import { MAIL_DIR } from '../../playwright.config'

type Mail = { to: string; subject: string; text: string }

/** Waits for the newest mail to `to` written by the app (E2E_MAIL_DIR) and returns the first link matching `re`. */
export async function linkFromMail(to: string, re: RegExp, since = 0, timeoutMs = 10_000): Promise<string> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const files = (await readdir(MAIL_DIR).catch(() => [] as string[])).filter((f) => Number(f.split('-')[0]) >= since).sort().reverse()
    for (const f of files) {
      const mail = JSON.parse(await readFile(`${MAIL_DIR}/${f}`, 'utf8')) as Mail
      const m = mail.to.toLowerCase() === to.toLowerCase() ? re.exec(mail.text) : null
      if (m) return m[0]
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`No mail to ${to} matching ${re}`)
}
