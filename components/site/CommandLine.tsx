'use client'
import dynamic from 'next/dynamic'
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Command, Hit } from '@/components/ds/CommandBar'
import { CommandHint } from '@/components/ds/primitives'
import { setTheme } from '@/components/ds/ThemeToggle'
import { formatDate } from '@/lib/format'

// The command bar's code is only downloaded the first time someone presses ":".
const CommandBar = dynamic(() => import('@/components/ds/CommandBar'), { ssr: false })

type Ctx = { open: () => void; register: (cmds: Command[]) => () => void }
const CommandCtx = createContext<Ctx | null>(null)

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

const themeCommand: Command = {
  cmd: 'theme',
  desc: 'Switch theme, or :theme dark / :theme light',
  run: (args) => {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    setTheme(args[0] === 'dark' || args[0] === 'light' ? args[0] : cur === 'dark' ? 'light' : 'dark')
  },
}

export const SITE_COMMANDS: Command[] = [
  { cmd: 'home', aliases: ['h'], desc: 'Go to Home', href: '/' },
  { cmd: 'blogs', aliases: ['b', 'blog'], desc: 'Go to Blogs', href: '/blogs' },
  { cmd: 'projects', aliases: ['p'], desc: 'Go to Projects', href: '/projects' },
  { cmd: 'about', aliases: ['a'], desc: 'Go to About', href: '/about' },
  { cmd: 'search', aliases: ['s'], desc: 'Search posts: :search fret' },
  { cmd: 'subscribe', aliases: ['sub'], desc: 'Jump to the email form in the footer', href: '#subscribe' },
  themeCommand,
  { cmd: 'admin', desc: 'Open the admin (owner only)', href: '/admin' },
]

export const ADMIN_COMMANDS: Command[] = [
  { cmd: 'posts', aliases: ['p'], desc: 'All posts and drafts', href: '/admin/posts' },
  { cmd: 'drafts', desc: 'Drafts only', href: '/admin/posts?tab=draft' },
  { cmd: 'diary', desc: 'Diary entries', href: '/admin/posts?tab=diary' },
  { cmd: 'dashboard', aliases: ['d'], desc: 'Admin home', href: '/admin' },
  { cmd: 'manage', aliases: ['m'], desc: 'Collections, projects, subscribers, sharing', href: '/admin/manage' },
  { cmd: 'site', aliases: ['home'], desc: 'View the public site', href: '/' },
  themeCommand,
]

async function search(q: string): Promise<Hit[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  const data = (await res.json()) as { hits: { slug: string; title: string; collection: string | null; publishedAt: string | null; status?: string; id: string }[]; owner?: boolean }
  return data.hits.map((h) => ({
    label: h.title || '(untitled)',
    meta: [h.collection, formatDate(h.publishedAt)].filter(Boolean).join(' · '),
    href: data.owner ? `/admin/editor/${h.id}` : `/blogs/${h.slug}`,
  }))
}

export function CommandProvider({
  base,
  placeholder,
  children,
}: {
  base: 'site' | 'admin'
  placeholder?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [extra, setExtra] = useState<Command[][]>([])

  const show = useCallback(() => {
    setLoaded(true)
    setOpen(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ':' && !isTyping(e.target) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  const register = useCallback((cmds: Command[]) => {
    setExtra((cur) => [...cur, cmds])
    return () => setExtra((cur) => cur.filter((c) => c !== cmds))
  }, [])

  const commands = useMemo(() => {
    const own = extra.flat()
    const names = new Set(own.map((c) => c.cmd))
    const baseCmds = base === 'admin' ? ADMIN_COMMANDS : SITE_COMMANDS
    return [...own, ...baseCmds.filter((c) => !names.has(c.cmd))]
  }, [extra, base])

  const ctx = useMemo(() => ({ open: show, register }), [show, register])

  return (
    <CommandCtx value={ctx}>
      {children}
      {loaded && open ? (
        <CommandBar
          open
          onClose={() => setOpen(false)}
          commands={commands}
          placeholder={placeholder ?? (base === 'admin' ? 'write, posts, drafts, manage, site' : 'blogs, projects, about, search')}
          onSearch={search}
        />
      ) : null}
    </CommandCtx>
  )
}

export function useCommandLine() {
  const ctx = use(CommandCtx)
  if (!ctx) throw new Error('useCommandLine must be used inside <CommandProvider>')
  return ctx
}

/** Adds page-specific commands (e.g. ":tag piano" on Blogs) while the component is mounted. */
export function useRegisterCommands(cmds: Command[]) {
  const { register } = useCommandLine()
  const ref = useRef(cmds)
  useEffect(() => {
    ref.current = cmds
  })
  useEffect(() => {
    // Wrap so the latest closures run even though we register once.
    const proxied = ref.current.map((c) => ({ ...c, run: c.run ? (args: string[]) => ref.current.find((x) => x.cmd === c.cmd)?.run?.(args) : undefined }))
    return register(proxied)
  }, [register])
}

export function OpenCommandButton({ label }: { label?: string }) {
  const { open } = useCommandLine()
  return <CommandHint onClick={open} label={label} />
}
