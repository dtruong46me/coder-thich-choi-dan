'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import { SearchField } from '@/components/ds/fields'
import { Icon } from '@/components/ds/Icon'
import { Button, StatusPill, VISIBILITY, VisibilityBadge } from '@/components/ds/primitives'
import { Segmented } from '@/components/ds/Segmented'
import { useRegisterCommands } from '@/components/site/CommandLine'
import { authClient } from '@/lib/auth-client'
import {
  deleteProject,
  exportSubscribers,
  removeSubscribers,
  reorderCollections,
  reorderProjects,
  saveCollection,
  saveProject,
  sendTestEmail,
  setProjectFeatured,
  signOutEverywhere,
  updateSettings,
} from '@/lib/actions/manage'
import { grantAccess, revokeAccess } from '@/lib/actions/posts'
import type { Visibility } from '@/lib/db/schema'
import { formatDate } from '@/lib/format'
import { SOCIALS } from '@/lib/site'
import { slugify } from '@/lib/slug'

type Tab = 'collections' | 'projects' | 'subscribers' | 'sharing' | 'settings'
type Collection = { id: string; slug: string; name: string; description: string; defaultVisibility: Visibility; count: number }
type Project = {
  id: string
  slug: string
  name: string
  kind: string
  status: 'shipped' | 'in_progress' | 'archived'
  year: string
  description: string
  stack: string[]
  links: { label: string; href: string }[]
  featured: boolean
  postId: string | null
}
type Subscriber = { id: string; masked: string; status: string; topics: string[]; createdAt: string }
type Grant = { id: string; email: string; scope: string; postTitle: string | null; createdAt: string }

const TABS: { value: Tab; label: string }[] = [
  { value: 'collections', label: 'Collections' },
  { value: 'projects', label: 'Projects' },
  { value: 'subscribers', label: 'Subscribers' },
  { value: 'sharing', label: 'Sharing' },
  { value: 'settings', label: 'Settings' },
]
const KINDS: Record<string, string> = { web: 'Web', music: 'Music tool', cli: 'CLI', course: 'Coursework' }
const PSTATUS = { shipped: ['SHIPPED', 'accent'], in_progress: ['IN PROGRESS', 'ochre'], archived: ['ARCHIVED', 'muted'] } as const
const SSTATUS: Record<string, 'accent' | 'ochre' | 'muted' | 'danger'> = { confirmed: 'accent', pending: 'ochre', unsubscribed: 'muted', bounced: 'danger' }
const SCOPES: Record<string, string> = { post: 'One diary entry', all_shared_diary: 'All Shared diary entries', members: 'Members-only posts' }

function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done = 'Saved.') =>
    start(async () => {
      const res = await fn()
      setMsg(res.ok ? done : (res.error ?? 'Something went wrong.'))
      if (res.ok) router.refresh()
    })
  return { pending, msg, run, setMsg }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="fl">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function ManageTabs(props: {
  initialTab: string
  collections: Collection[]
  projects: Project[]
  subscribers: Subscriber[]
  subscriberStats: { confirmed: number; pending: number }
  grants: Grant[]
  shareable: { id: string; title: string; kind: string }[]
  settings: Record<string, unknown>
  mailConnected: boolean
}) {
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.value === props.initialTab) ? (props.initialTab as Tab) : 'collections')
  const { pending, msg, run, setMsg } = useAction()

  useRegisterCommands([
    { cmd: 'collections', desc: 'Collections tab', run: () => setTab('collections') },
    { cmd: 'subscribers', aliases: ['subs'], desc: 'Subscribers tab', run: () => setTab('subscribers') },
    { cmd: 'sharing', desc: 'Who can read your diary', run: () => setTab('sharing') },
    { cmd: 'settings', desc: 'Site settings', run: () => setTab('settings') },
  ])

  return (
    <div className="stack-16" style={{ gap: 22 }}>
      <div className="stack-8" style={{ gap: 6 }}>
        <span className="kicker-path">~/admin/manage</span>
        <h1 className="h1 m0 page-title">Manage the site</h1>
      </div>
      <Segmented
        label="Section"
        value={tab}
        onChange={(v) => {
          setTab(v)
          setMsg('')
          window.history.replaceState(null, '', `?tab=${v}`)
        }}
        options={TABS}
      />
      {msg ? (
        <p className="small m0 muted" role="status">
          {msg}
        </p>
      ) : null}
      {tab === 'collections' ? <Collections items={props.collections} run={run} pending={pending} /> : null}
      {tab === 'projects' ? <Projects items={props.projects} run={run} pending={pending} /> : null}
      {tab === 'subscribers' ? <Subscribers items={props.subscribers} stats={props.subscriberStats} mailConnected={props.mailConnected} run={run} pending={pending} /> : null}
      {tab === 'sharing' ? <Sharing grants={props.grants} shareable={props.shareable} run={run} pending={pending} /> : null}
      {tab === 'settings' ? <Settings settings={props.settings} run={run} pending={pending} /> : null}
    </div>
  )
}

type RunProps = { run: ReturnType<typeof useAction>['run']; pending: boolean }

/* ---------------------------------------------------------------- Collections */

function Collections({ items, run, pending }: { items: Collection[] } & RunProps) {
  const [editing, setEditing] = useState<Partial<Collection> | null>(null)
  const move = (i: number, d: -1 | 1) => {
    const ids = items.map((c) => c.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    run(() => reorderCollections(ids), 'Order saved.')
  }
  return (
    <section className="stack-12" style={{ gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <p className="m0 muted">The order here is the order on the home page.</p>
        <Button size="sm" onClick={() => setEditing({ name: '', slug: '', description: '', defaultVisibility: 'public' })}>
          New collection
        </Button>
      </div>
      {editing ? (
        <form
          className="panel stack-12"
          style={{ padding: 18 }}
          onSubmit={(e) => {
            e.preventDefault()
            run(
              () =>
                saveCollection({
                  id: editing.id,
                  name: editing.name ?? '',
                  slug: editing.slug || slugify(editing.name ?? ''),
                  description: editing.description ?? '',
                  defaultVisibility: editing.defaultVisibility ?? 'public',
                }),
              'Collection saved.',
            )
            setEditing(null)
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Field label="NAME">
              <input className="inp" required value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="URL SLUG">
              <input className="inp mono" value={editing.slug ?? ''} placeholder={slugify(editing.name ?? '')} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
            </Field>
            <Field label="DEFAULT FOR NEW POSTS">
              <select className="inp" value={editing.defaultVisibility} onChange={(e) => setEditing({ ...editing, defaultVisibility: e.target.value as Visibility })}>
                {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY[v].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="DESCRIPTION">
            <input className="inp" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </Field>
          <div className="row-8">
            <Button type="submit" size="sm" disabled={pending}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      <div className="panel">
        {items.map((c, i) => (
          <div key={c.id} className="lr">
            <span className="stack-8" style={{ gap: 0 }}>
              <button type="button" className="hb" aria-label={`Move ${c.name} up`} disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className="hb" aria-label={`Move ${c.name} down`} disabled={i === items.length - 1 || pending} onClick={() => move(i, 1)}>
                ↓
              </button>
            </span>
            <span className="mono accent" style={{ flex: '0 0 34px', fontSize: 14 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ flex: '1 1 280px', minWidth: 0 }} className="stack-8">
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 500 }}>{c.name}</span>
              <span className="small muted">{c.description}</span>
            </span>
            <span className="small muted" style={{ flex: '0 0 80px' }}>
              {c.count} {c.defaultVisibility === 'private' ? 'entries' : 'posts'}
            </span>
            <span className="stack-8" style={{ flex: '0 0 150px', gap: 4 }}>
              <span className="small muted">Default for new posts</span>
              <VisibilityBadge mode={c.defaultVisibility} />
            </span>
            <button type="button" className="mini" onClick={() => setEditing(c)}>
              Edit
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Projects */

const emptyProject = (): Project => ({ id: '', slug: '', name: '', kind: 'web', status: 'in_progress', year: String(new Date().getFullYear()), description: '', stack: [], links: [], featured: false, postId: null })

function Projects({ items, run, pending }: { items: Project[] } & RunProps) {
  const [editing, setEditing] = useState<Project | null>(null)
  const move = (i: number, d: -1 | 1) => {
    const ids = items.map((p) => p.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    run(() => reorderProjects(ids), 'Order saved.')
  }
  return (
    <section className="stack-12" style={{ gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <p className="m0 muted">Featured projects show on the home page, in this order.</p>
        <Button size="sm" onClick={() => setEditing(emptyProject())}>
          New project
        </Button>
      </div>
      {editing ? (
        <form
          className="panel stack-12"
          style={{ padding: 18 }}
          onSubmit={(e) => {
            e.preventDefault()
            const { id, ...rest } = editing
            run(() => saveProject({ ...rest, kind: rest.kind as 'web' | 'music' | 'cli' | 'course', id: id || undefined, slug: rest.slug || slugify(rest.name) }), 'Project saved.')
            setEditing(null)
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="NAME">
              <input className="inp" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="TYPE">
              <select className="inp" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
                {Object.entries(KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="STATUS">
              <select className="inp" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Project['status'] })}>
                <option value="shipped">Shipped</option>
                <option value="in_progress">In progress</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="YEAR">
              <input className="inp mono" value={editing.year} onChange={(e) => setEditing({ ...editing, year: e.target.value })} />
            </Field>
          </div>
          <Field label="DESCRIPTION">
            <textarea className="inp" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </Field>
          <Field label="STACK (COMMA SEPARATED)">
            <input className="inp mono" value={editing.stack.join(', ')} onChange={(e) => setEditing({ ...editing, stack: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="LINKS (ONE PER LINE: LABEL | URL)">
            <textarea
              className="inp mono"
              value={editing.links.map((l) => `${l.label} | ${l.href}`).join('\n')}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  links: e.target.value
                    .split('\n')
                    .map((line) => line.split('|').map((s) => s.trim()))
                    .filter((p) => p.length === 2 && p[0] && p[1])
                    .map(([label, href]) => ({ label: label!, href: href! })),
                })
              }
            />
          </Field>
          <label className="row-8">
            <input type="checkbox" className="check" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} />
            Show on the home page
          </label>
          <div className="row-8">
            <Button type="submit" size="sm" disabled={pending}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="atable" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th scope="col">PROJECT</th>
              <th scope="col">TYPE</th>
              <th scope="col">STATUS</th>
              <th scope="col">YEAR</th>
              <th scope="col">FEATURED</th>
              <th scope="col">
                <span className="ct-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={p.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>{p.name}</span>
                </td>
                <td className="small muted">{KINDS[p.kind] ?? p.kind}</td>
                <td>
                  <StatusPill tone={PSTATUS[p.status][1]}>{PSTATUS[p.status][0]}</StatusPill>
                </td>
                <td className="mono muted" style={{ fontSize: 13 }}>
                  {p.year}
                </td>
                <td>
                  <label className="row-8" style={{ minHeight: 36, cursor: 'pointer' }}>
                    <input type="checkbox" className="check" checked={p.featured} disabled={pending} onChange={() => run(() => setProjectFeatured(p.id, !p.featured))} />
                    <span className="small">{p.featured ? 'On home' : 'Hidden'}</span>
                  </label>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" className="hb" aria-label={`Move ${p.name} up`} disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="hb" aria-label={`Move ${p.name} down`} disabled={i === items.length - 1 || pending} onClick={() => move(i, 1)}>
                    ↓
                  </button>{' '}
                  <button type="button" className="mini" onClick={() => setEditing(p)}>
                    Edit
                  </button>{' '}
                  <button type="button" className="mini danger" disabled={pending} onClick={() => window.confirm(`Delete ${p.name}?`) && run(() => deleteProject(p.id), 'Deleted.')}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Subscribers */

function Subscribers({ items, stats, mailConnected, run, pending }: { items: Subscriber[]; stats: { confirmed: number; pending: number }; mailConnected: boolean } & RunProps) {
  const [q, setQ] = useState('')
  const list = items.filter((s) => !q || s.masked.includes(q.toLowerCase()) || s.topics.join(' ').toLowerCase().includes(q.toLowerCase()))
  async function downloadCsv() {
    const res = await exportSubscribers()
    if (!res.ok) return
    const url = URL.createObjectURL(new Blob([res.csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section className="stack-12" style={{ gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <div className="panel" style={{ padding: 18 }}>
          <span className="label muted">CONFIRMED</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 500 }}>{stats.confirmed}</div>
        </div>
        <div className="panel" style={{ padding: 18 }}>
          <span className="label muted">PENDING CONFIRMATION</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 500 }}>{stats.pending}</div>
        </div>
        <div className="panel" style={{ padding: 18 }}>
          <span className="label muted">MAIL PROVIDER</span>
          <div className="stack-8" style={{ marginTop: 8, gap: 6 }}>
            <span>{mailConnected ? 'Resend, connected' : 'Not connected: emails go to the server log'}</span>
          </div>
        </div>
      </div>
      <div className="row-8" style={{ gap: 10 }}>
        <SearchField value={q} onChange={setQ} placeholder="Search by email or topic…" label="Search subscribers" />
        <button type="button" className="mini" onClick={() => void downloadCsv()}>
          Export CSV
        </button>
        <button type="button" className="mini" disabled={pending} onClick={() => run(() => sendTestEmail(), 'Test email sent to you.')}>
          Send test email
        </button>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="atable" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th scope="col">EMAIL</th>
              <th scope="col">TOPICS</th>
              <th scope="col">STATUS</th>
              <th scope="col">JOINED</th>
              <th scope="col">
                <span className="ct-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td className="mono" style={{ fontSize: 13 }}>
                  {s.masked}
                </td>
                <td>
                  <span className="row-8" style={{ gap: 4 }}>
                    {s.topics.map((t) => (
                      <span key={t} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)' }}>
                        {t}
                      </span>
                    ))}
                  </span>
                </td>
                <td>
                  <StatusPill tone={SSTATUS[s.status] ?? 'muted'}>{s.status.toUpperCase()}</StatusPill>
                </td>
                <td className="mono muted" style={{ fontSize: 13 }}>
                  {formatDate(s.createdAt, { year: false })}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="mini" disabled={pending} onClick={() => window.confirm(`Remove ${s.masked}?`) && run(() => removeSubscribers([s.id]), 'Removed.')}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length ? <p className="m0 muted" style={{ padding: 20 }}>No subscribers yet.</p> : null}
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Sharing */

function Sharing({ grants, shareable, run, pending }: { grants: Grant[]; shareable: { id: string; title: string; kind: string }[] } & RunProps) {
  const [email, setEmail] = useState('')
  const [scope, setScope] = useState<'post' | 'all_shared_diary' | 'members'>(shareable.length ? 'post' : 'all_shared_diary')
  const [postId, setPostId] = useState(shareable[0]?.id ?? '')
  return (
    <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <div className="panel" style={{ flex: '2 1 460px', minWidth: 0 }}>
        <div style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <h2 className="h3 m0" style={{ fontSize: 22 }}>
            People with access
          </h2>
          <span className="small muted">
            {grants.length} {grants.length === 1 ? 'grant' : 'grants'}
          </span>
        </div>
        {grants.map((g) => (
          <div key={g.id} className="lr">
            <span className="avatar ochre" aria-hidden="true">
              {g.email.slice(0, 1).toUpperCase()}
            </span>
            <span style={{ flex: '1 1 200px', minWidth: 0 }} className="stack-8">
              <span style={{ fontWeight: 600 }}>{g.email.split('@')[0]}</span>
              <span className="small mono muted">{g.email}</span>
            </span>
            <span className="small muted" style={{ flex: '0 1 220px' }}>
              {g.scope === 'post' && g.postTitle ? `“${g.postTitle}”` : SCOPES[g.scope]}
            </span>
            <button type="button" className="mini danger" disabled={pending} onClick={() => run(() => revokeAccess(g.id), 'Access revoked.')}>
              Revoke
            </button>
          </div>
        ))}
        {!grants.length ? <p className="m0 muted" style={{ padding: 18, borderTop: '1px solid var(--line)' }}>Nobody yet. Your diary is all yours.</p> : null}
      </div>
      <form
        className="panel stack-12"
        style={{ flex: '1 1 300px', minWidth: 0, padding: 18, gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault()
          run(() => grantAccess({ email, scope, postId: scope === 'post' ? postId : null }), 'Invite sent.')
          setEmail('')
        }}
      >
        <h2 className="h3 m0" style={{ fontSize: 22 }}>
          Invite someone
        </h2>
        <Field label="EMAIL">
          <input className="inp" type="email" required placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="CAN READ">
          <select className="inp" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="post" disabled={!shareable.length}>
              One entry
            </option>
            <option value="all_shared_diary">All Shared diary entries</option>
            <option value="members">Members-only posts</option>
          </select>
        </Field>
        {scope === 'post' ? (
          <Field label="ENTRY (MODE: SHARED)">
            <select className="inp" value={postId} onChange={(e) => setPostId(e.target.value)}>
              {shareable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || 'Untitled'}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Button type="submit" disabled={pending}>
          Send invite
        </Button>
        <span className="small muted">They get a sign-in link by email. Private entries stay private even for invited people.</span>
      </form>
    </section>
  )
}

/* ---------------------------------------------------------------- Settings */

function Settings({ settings, run, pending }: { settings: Record<string, unknown> } & RunProps) {
  const str = (k: string, d: string) => (typeof settings[k] === 'string' ? (settings[k] as string) : d)
  const [form, setForm] = useState({
    name: str('name', 'Coder thích chơi đàn'),
    handle: str('handle', '@coderthichchoidan'),
    tagline: str('tagline', 'A coder who plays guitar & piano, keeping notes'),
    defaultTheme: str('defaultTheme', 'auto') as 'light' | 'dark' | 'auto',
    membersSignup: settings.membersSignup !== false,
    socials: { ...Object.fromEntries(SOCIALS.map((s) => [s.icon, s.href])), ...((settings.socials as Record<string, string>) ?? {}) },
  })
  const [passkeyMsg, setPasskeyMsg] = useState('')
  return (
    <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <div className="panel stack-12" style={{ flex: '1 1 420px', minWidth: 0, padding: 20, gap: 14 }}>
        <h2 className="h3 m0" style={{ fontSize: 22 }}>
          Site
        </h2>
        <Field label="SITE NAME">
          <input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="HANDLE">
          <input className="inp mono" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
        </Field>
        <Field label="TAGLINE">
          <input className="inp" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        </Field>
        <Field label="DEFAULT THEME">
          <select className="inp" value={form.defaultTheme} onChange={(e) => setForm({ ...form, defaultTheme: e.target.value as typeof form.defaultTheme })}>
            <option value="light">Light (ivory)</option>
            <option value="dark">Dark (charcoal)</option>
            <option value="auto">Follow the visitor&apos;s system</option>
          </select>
        </Field>
        <label className="toggle-row" style={{ minHeight: 44 }}>
          <span style={{ fontWeight: 500 }}>Let visitors sign up as Members</span>
          <input type="checkbox" className="check" checked={form.membersSignup} onChange={(e) => setForm({ ...form, membersSignup: e.target.checked })} />
        </label>
      </div>
      <div className="panel stack-12" style={{ flex: '1 1 420px', minWidth: 0, padding: 20, gap: 14 }}>
        <h2 className="h3 m0" style={{ fontSize: 22 }}>
          Social links
        </h2>
        {SOCIALS.map((s) => (
          <label key={s.icon} className="row-12" style={{ flexWrap: 'nowrap' }}>
            <Icon name={s.icon} size={18} />
            <span style={{ flex: '0 0 90px', fontWeight: 500 }}>{s.label}</span>
            <input className="inp mono" style={{ fontSize: 13 }} value={form.socials[s.icon] ?? ''} onChange={(e) => setForm({ ...form, socials: { ...form.socials, [s.icon]: e.target.value } })} />
          </label>
        ))}
      </div>
      <div className="panel stack-12" style={{ flex: '1 1 420px', minWidth: 0, padding: 20, gap: 14 }}>
        <h2 className="h3 m0" style={{ fontSize: 22 }}>
          Sign-in and devices
        </h2>
        <p className="m0 muted small">Passkeys use your fingerprint or face. Add one on each device you write from.</p>
        <div className="row-8">
          <Button
            variant="ghost"
            size="sm"
            icon="lock"
            onClick={async () => {
              const res = await authClient.passkey.addPasskey()
              setPasskeyMsg(res?.error ? (res.error.message ?? 'Could not add the passkey.') : 'Passkey added.')
            }}
          >
            Add a passkey
          </Button>
          <button
            type="button"
            className="mini danger"
            disabled={pending}
            onClick={() => window.confirm('Sign out on every device, including this one?') && run(() => signOutEverywhere(), 'Signed out everywhere.')}
          >
            Sign out everywhere
          </button>
        </div>
        {passkeyMsg ? <p className="small m0 muted">{passkeyMsg}</p> : null}
      </div>
      <div style={{ flex: '1 1 100%', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button disabled={pending} onClick={() => run(() => updateSettings(form), 'Settings saved.')}>
          Save changes
        </Button>
      </div>
    </section>
  )
}
