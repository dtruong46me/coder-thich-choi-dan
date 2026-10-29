import type { ReactNode } from 'react'
import { CommandProvider } from '@/components/site/CommandLine'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <CommandProvider base="site">
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </CommandProvider>
  )
}
