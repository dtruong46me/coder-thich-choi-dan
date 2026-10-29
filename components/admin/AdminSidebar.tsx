'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Icon, type IconName } from '@/components/ds/Icon'
import { Logo } from '@/components/ds/primitives'
import { ThemeToggle } from '@/components/ds/ThemeToggle'
import { OpenCommandButton } from '@/components/site/CommandLine'
import { createPost } from '@/lib/actions/posts'

type Counts = { posts: number; drafts: number; diary: number }

function Item({ href, icon, label, count, on }: { href: string; icon: IconName; label: string; count?: string; on: boolean }) {
  return (
    <Link className={on ? 'sb on' : 'sb'} href={href} aria-current={on ? 'page' : undefined}>
      <Icon name={icon} size={18} />
      {label}
      {count ? <span className="cnt">{count}</span> : null}
    </Link>
  )
}

function Nav({ counts }: { counts: Counts }) {
  const path = usePathname()
  const params = useSearchParams()
  const tab = params.get('tab')
  return (
    <nav aria-label="Admin" className="stack-8" style={{ gap: 2 }}>
      <span className="sbl">Write</span>
      <Item href="/admin" icon="grid" label="Dashboard" on={path === '/admin'} />
      <Item href="/admin/posts?tab=draft" icon="pen" label="Drafts" count={`${counts.drafts}`} on={path === '/admin/posts' && tab === 'draft'} />
      <Item href="/admin/posts" icon="file" label="Posts" count={`${counts.posts}`} on={path === '/admin/posts' && tab !== 'draft' && tab !== 'diary'} />
      <Item href="/admin/posts?tab=diary" icon="book" label="Diary" count={`${counts.diary}`} on={path === '/admin/posts' && tab === 'diary'} />
      <span className="sbl">Manage</span>
      <Item href="/admin/manage?tab=collections" icon="folder" label="Collections" on={path === '/admin/manage' && (!tab || tab === 'collections')} />
      <Item href="/admin/manage?tab=projects" icon="box" label="Projects" on={path === '/admin/manage' && tab === 'projects'} />
      <Item href="/admin/manage?tab=subscribers" icon="mail" label="Subscribers" on={path === '/admin/manage' && tab === 'subscribers'} />
      <Item href="/admin/manage?tab=sharing" icon="share" label="Sharing" on={path === '/admin/manage' && tab === 'sharing'} />
      <span className="sbl">Site</span>
      <Item href="/admin/manage?tab=settings" icon="settings" label="Settings" on={path === '/admin/manage' && tab === 'settings'} />
      <Item href="/" icon="external" label="View site" on={false} />
    </nav>
  )
}

export function AdminSidebar({ counts, email }: { counts: Counts; email: string }) {
  return (
    <aside className="admin-side">
      <div style={{ padding: '0 4px' }}>
        <Logo size="sm" showHandle={false} href="/" />
      </div>
      <form action={createPost}>
        <input type="hidden" name="kind" value="blog" />
        <button type="submit" className="newbtn">
          <Icon name="plus" size={16} strokeWidth={2.4} />
          New post
        </button>
      </form>
      <Suspense fallback={null}>
        <Nav counts={counts} />
      </Suspense>
      <div className="stack-8" style={{ marginTop: 'auto', gap: 10 }}>
        <OpenCommandButton label="Commands" />
        <div className="row-8" style={{ gap: 10, padding: '12px 6px 0', borderTop: '1px solid var(--line)', flexWrap: 'nowrap' }}>
          <span className="avatar" aria-hidden="true">
            ĐT
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Đình Trường</span>
            <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={email}>
              Owner
            </span>
          </span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
