'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/blogs', label: 'Blogs' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
]

/** Active state needs the URL, which is only known at request time on dynamic routes. */
export function NavLinks() {
  return <NavList path={usePathname()} />
}

export function NavList({ path }: { path: string | null }) {
  return (
    <nav aria-label="Main" className="site-nav">
      {LINKS.map((l) => {
        const on = !!path && (l.href === '/' ? path === '/' : path.startsWith(l.href))
        return (
          <Link key={l.href} className={on ? 'nl on' : 'nl'} href={l.href} aria-current={on ? 'page' : undefined}>
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
