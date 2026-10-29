'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'
import { SearchField } from '@/components/ds/fields'
import { Button, StatusPill, VisibilityBadge } from '@/components/ds/primitives'
import { Segmented } from '@/components/ds/Segmented'
import { useRegisterCommands } from '@/components/site/CommandLine'
import { bulkUpdate, newPost, saveDraft } from '@/lib/actions/posts'
import { markdownToDoc } from '@/lib/content/markdown'
import type { PostStatus, Visibility } from '@/lib/db/schema'
import { formatDate } from '@/lib/format'
import { slugify } from '@/lib/slug'

type Row = {
  id: string
  kind: 'blog' | 'diary'
  title: string
  status: PostStatus
  visibility: Visibility
  collection: string | null
  tags: string[]
  views: number
  sharedCount: number
  updatedAt: string
  scheduledAt: string | null
}

const STATUS: Record<PostStatus, [string, 'accent' | 'muted' | 'ochre' | 'danger']> = {
  published: ['PUBLISHED', 'accent'],
  draft: ['DRAFT', 'muted'],
  scheduled: ['SCHEDULED', 'ochre'],
  archived: ['ARCHIVED', 'muted'],
}

const TABS: [string, string, (r: Row) => boolean][] = [
  ['all', 'All', () => true],
  ['published', 'Published', (r) => r.status === 'published' && r.kind === 'blog'],
  ['draft', 'Drafts', (r) => r.status === 'draft'],
  ['scheduled', 'Scheduled', (r) => r.status === 'scheduled'],
  ['diary', 'Diary', (r) => r.kind === 'diary'],
]

export function PostsTable({ rows, collections, initialTab }: { rows: Row[]; collections: { id: string; name: string }[]; initialTab: string }) {
  const router = useRouter()
  const [tab, setTab] = useState(TABS.some((t) => t[0] === initialTab) ? initialTab : 'all')
  const [query, setQuery] = useState('')
  const [col, setCol] = useState('all')
  const [vis, setVis] = useState('all')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  useRegisterCommands([
    { cmd: 'search', aliases: ['s'], desc: 'Search posts: :search kyoto', run: (a) => setQuery(a.join(' ')) },
    { cmd: 'drafts', desc: 'Show drafts only', run: () => setTab('draft') },
    { cmd: 'diary', desc: 'Show diary entries', run: () => setTab('diary') },
  ])

  const tabFn = (TABS.find((t) => t[0] === tab) ?? TABS[0]!)[2]
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter(tabFn)
      .filter((r) => col === 'all' || r.collection === col)
      .filter((r) => vis === 'all' || r.visibility === vis)
      .filter((r) => !q || `${r.title} ${r.tags.join(' ')} ${r.collection ?? ''}`.toLowerCase().includes(q))
  }, [rows, tabFn, col, vis, query])

  const allSel = list.length > 0 && list.every((r) => sel.has(r.id))
  const toggle = (id: string) =>
    setSel((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  function bulk(change: Parameters<typeof bulkUpdate>[1], confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    start(async () => {
      const res = await bulkUpdate([...sel], change)
      setMsg(res.ok ? 'Done.' : res.error)
      if (res.ok) {
        setSel(new Set())
        router.refresh()
      }
    })
  }

  async function importMarkdown(file: File) {
    const text = await file.text()
    const { doc, meta } = markdownToDoc(text)
    const { id } = await newPost('blog')
    const title = meta.title ?? file.name.replace(/\.md$/i, '')
    const res = await saveDraft({
      postId: id,
      baseVersion: 0,
      title,
      draftJson: doc,
      reason: 'manual',
      meta: { slug: meta.slug ?? (slugify(title) || undefined), excerpt: meta.excerpt, tags: meta.tags },
    })
    if (!res.ok) setMsg(res.error)
    router.push(`/admin/editor/${id}`)
  }

  return (
    <div className="stack-16" style={{ gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div className="stack-8" style={{ gap: 6 }}>
          <span className="kicker-path">~/admin/posts</span>
          <h1 className="h1 m0 page-title">Posts &amp; diary</h1>
        </div>
        <div className="row-8" style={{ gap: 10 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,text/markdown"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importMarkdown(f)
            }}
          />
          <Button variant="ghost" icon="copy" onClick={() => fileRef.current?.click()}>
            Import Markdown
          </Button>
          <Button onClick={() => void newPost('blog').then(({ id }) => router.push(`/admin/editor/${id}`))}>New post</Button>
        </div>
      </div>

      <Segmented label="Status" value={tab} onChange={(v) => { setTab(v); setSel(new Set()) }} options={TABS.map(([v, l, f]) => ({ value: v, label: `${l} ${rows.filter(f).length}` }))} />

      <div className="row-12">
        <SearchField value={query} onChange={setQuery} placeholder="Search titles, tags…" />
        <label htmlFor="fcol" className="row-8 muted" style={{ fontSize: 14 }}>
          Collection
          <select id="fcol" className="select" value={col} onChange={(e) => setCol(e.target.value)}>
            <option value="all">All</option>
            {collections.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="fvis" className="row-8 muted" style={{ fontSize: 14 }}>
          Visibility
          <select id="fvis" className="select" value={vis} onChange={(e) => setVis(e.target.value)}>
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="members">Members</option>
            <option value="shared">Shared</option>
            <option value="private">Private</option>
          </select>
        </label>
      </div>

      {sel.size ? (
        <div role="toolbar" aria-label="Bulk actions" className="row-8" style={{ gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--accent-soft)' }}>
          <span className="accent" style={{ fontWeight: 600 }}>
            {sel.size} selected
          </span>
          <select
            aria-label="Change visibility"
            className="mini"
            value=""
            disabled={pending}
            onChange={(e) => e.target.value && bulk({ visibility: e.target.value })}
          >
            <option value="">Change visibility…</option>
            <option value="public">Public (diary entries skipped)</option>
            <option value="unlisted">Unlisted</option>
            <option value="members">Members</option>
            <option value="shared">Shared</option>
            <option value="private">Private</option>
          </select>
          <select aria-label="Move to collection" className="mini" value="" disabled={pending} onChange={(e) => e.target.value && bulk({ collectionId: e.target.value })}>
            <option value="">Move to collection…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" className="mini" disabled={pending} onClick={() => bulk({ unpublish: true })}>
            Unpublish
          </button>
          <button type="button" className="mini danger" disabled={pending} onClick={() => bulk({ delete: true }, `Delete ${sel.size} post(s)? They disappear from the site; the rows stay in the database (soft delete).`)}>
            Delete
          </button>
          <button type="button" className="mini" style={{ marginLeft: 'auto' }} onClick={() => setSel(new Set())}>
            Clear
          </button>
        </div>
      ) : null}
      {msg ? (
        <p className="small m0 muted" role="status">
          {msg}
        </p>
      ) : null}

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="atable" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th scope="col" style={{ width: 40 }}>
                <input
                  type="checkbox"
                  className="check"
                  aria-label="Select all"
                  checked={allSel}
                  onChange={() => setSel(allSel ? new Set() : new Set(list.map((r) => r.id)))}
                />
              </th>
              <th scope="col">TITLE</th>
              <th scope="col">STATUS</th>
              <th scope="col">VISIBILITY</th>
              <th scope="col">UPDATED</th>
              <th scope="col" style={{ textAlign: 'right' }}>
                VIEWS
              </th>
              <th scope="col">
                <span className="ct-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className={sel.has(r.id) ? 'trow sel' : 'trow'}>
                <td>
                  <input type="checkbox" className="check" aria-label={`Select ${r.title || 'untitled'}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td style={{ minWidth: 300 }}>
                  <div className="stack-8" style={{ gap: 2 }}>
                    <Link className="tl" href={`/admin/editor/${r.id}`}>
                      {r.title || 'Untitled'}
                    </Link>
                    <span className="small muted">
                      {r.collection ?? 'No collection'} · {r.tags.length ? r.tags.map((t) => `#${t}`).join(' ') : 'no tags'}
                    </span>
                  </div>
                </td>
                <td>
                  <StatusPill tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</StatusPill>
                </td>
                <td>
                  <VisibilityBadge mode={r.visibility} count={r.sharedCount} />
                </td>
                <td className="mono muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                  {r.status === 'scheduled' && r.scheduledAt ? `${formatDate(r.scheduledAt, { year: false })} · ${new Date(r.scheduledAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })}` : formatDate(r.updatedAt, { year: false })}
                </td>
                <td className="mono" style={{ fontSize: 13, textAlign: 'right' }}>
                  {r.views ? r.views.toLocaleString('en-US') : '-'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Link href={`/admin/editor/${r.id}`} style={{ fontWeight: 500, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 36 }}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length ? <p className="m0 muted" style={{ padding: 28, textAlign: 'center' }}>Nothing here. Try another tab or clear the search.</p> : null}
      </div>
      <span className="small muted">
        Showing {list.length} of {rows.length}
      </span>
    </div>
  )
}
