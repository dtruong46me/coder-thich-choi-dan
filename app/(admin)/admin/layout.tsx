import type { Metadata } from 'next'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { CommandProvider } from '@/components/site/CommandLine'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

// Every admin route reads the session, so none of it can be instant from a static shell.
export const instant = false

/**
 * The admin is rendered entirely at request time (no prerendered shell). That is what lets Next.js put
 * the per-request CSP nonce from proxy.ts on every script tag; a static shell could not carry it.
 */
export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  await connection()
  return <CommandProvider base="admin">{children}</CommandProvider>
}
