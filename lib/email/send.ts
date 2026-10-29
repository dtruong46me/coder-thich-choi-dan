import 'server-only'
import { render } from '@react-email/components'
import type { ReactElement } from 'react'
import { Resend } from 'resend'

export type OutgoingEmail = {
  to: string
  subject: string
  react: ReactElement
  headers?: Record<string, string>
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM ?? 'Coder thích chơi đàn <hello@mail.coderthichchoidan.dev>'

async function toPayload(mail: OutgoingEmail) {
  const [html, text] = await Promise.all([render(mail.react), render(mail.react, { plainText: true })])
  return { from: FROM, to: mail.to, subject: mail.subject, html, text, headers: mail.headers }
}

/**
 * Without RESEND_API_KEY (local dev, previews) mail is printed to the log instead of sent.
 * E2E_MAIL_DIR (end-to-end tests only) also drops each mail as a JSON file the tests can read.
 */
function logMail(p: { to: string; subject: string; text: string }) {
  console.info(`\n[mail] to=${p.to} subject=${JSON.stringify(p.subject)}\n${p.text}\n`)
  const dir = process.env.E2E_MAIL_DIR
  if (dir) {
    void import('node:fs/promises').then(async (fs) => {
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(`${dir}/${Date.now()}-${Math.random().toString(36).slice(2)}.json`, JSON.stringify(p))
    })
  }
}

export async function sendEmail(mail: OutgoingEmail): Promise<{ id: string | null }> {
  const payload = await toPayload(mail)
  if (!resend) {
    logMail(payload)
    return { id: null }
  }
  const { data, error } = await resend.emails.send(payload)
  if (error) throw new Error(`Resend: ${error.message}`)
  return { id: data?.id ?? null }
}

/** Sends up to 100 emails in one provider call. Returns provider ids in input order. */
export async function sendBatch(mails: OutgoingEmail[], idempotencyKey: string): Promise<(string | null)[]> {
  const payloads = await Promise.all(mails.map(toPayload))
  if (!resend) {
    payloads.forEach(logMail)
    return payloads.map(() => null)
  }
  const { data, error } = await resend.batch.send(payloads, { idempotencyKey })
  if (error) throw new Error(`Resend batch: ${error.message}`)
  return payloads.map((_, i) => data?.data[i]?.id ?? null)
}
