'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSyncExternalStore, type MouseEvent } from 'react'
import { Icon } from '@/components/ds/Icon'

type NavigationEntry = { url: string | null }
type NavigationApi = {
  canGoBack?: boolean
  currentEntry?: { index: number } | null
  entries?: () => NavigationEntry[]
}

const noSubscribe = () => () => {}

/** True when the previous history entry is a page on this site (so going back keeps its filters and scroll). */
function cameFromSite() {
  const nav = (window as Window & { navigation?: NavigationApi }).navigation
  const i = nav?.currentEntry?.index ?? 0
  const prev = nav?.canGoBack && i > 0 ? nav.entries?.()[i - 1]?.url : null
  if (prev) return new URL(prev).origin === location.origin
  // No Navigation API: only a full page load from this site can be detected.
  return !!document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1
}

/**
 * "← All blogs" above a post. When the visitor came from another page here, it acts as the browser's Back
 * button instead, so a filtered list or the home page comes back as they left it.
 */
export function BackLink({ href = '/blogs', label = 'All blogs' }: { href?: string; label?: string }) {
  const router = useRouter()
  // false on the server and during hydration, so the prerendered link always says "All blogs".
  const back = useSyncExternalStore(noSubscribe, cameFromSite, () => false)

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!back || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    router.back()
  }

  return (
    <Link href={href} className="post-back" onClick={onClick}>
      <Icon name="arrow-left" size={16} />
      {back ? 'Back' : label}
    </Link>
  )
}
