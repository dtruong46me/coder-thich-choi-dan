import { Button, Logo } from '@/components/ds/primitives'
import { ThemeToggle } from '@/components/ds/ThemeToggle'
import { OpenCommandButton } from './CommandLine'
import { Suspense } from 'react'
import { NavLinks, NavList } from './NavLinks'

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-header-row">
        <Logo href="/" />
        <Suspense fallback={<NavList path={null} />}>
          <NavLinks />
        </Suspense>
        <div className="site-header-tools">
          <OpenCommandButton />
          <ThemeToggle />
          <Button size="sm" href="/#subscribe">
            Subscribe
          </Button>
        </div>
      </div>
    </header>
  )
}
