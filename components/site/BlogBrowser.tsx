'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PostCard } from '@/components/ds/cards'
import { SearchField } from '@/components/ds/fields'
import { Icon } from '@/components/ds/Icon'
import { Chip, VisibilityBadge } from '@/components/ds/primitives'
import { Segmented } from '@/components/ds/Segmented'
import { SubscribeBand } from '@/components/ds/SubscribeBand'
import { countLabel, isPrivateCollection } from '@/lib/collections'
import type { Card, CollectionSummary } from '@/lib/db/queries/public'
import { useRegisterCommands } from './CommandLine'

type Sort = 'new' | 'old' | 'az' | 'read'
type View = 'list' | 'grid' | 'collections'

const SORTERS: Record<Sort, (a: Card, b: Card) => number> = {
  new: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  old: (a, b) => a.publishedAt.localeCompare(b.publishedAt),
  az: (a, b) => (a.locked ? '~' : a.title).localeCompare(b.locked ? '~' : b.title),
  read: (a, b) => (a.locked ? 999 : a.readingMinutes) - (b.locked ? 999 : b.readingMinutes),
}

const fold = (s: string) => s.replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Filters run in the browser over the prerendered list: locked cards only carry date and collection. */
export function BlogBrowser({ cards, collections, topics }: { cards: Card[]; collections: CollectionSummary[]; topics: string[] }) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('all')
  const [col, setCol] = useState('all')
  const [sort, setSort] = useState<Sort>('new')
  const [view, setView] = useState<View>('list')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const c = p.get('collection')
    const t = p.get('tag')
    const q = p.get('q')
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the URL after hydration */
    if (c) setCol(c)
    if (t) setTag(t)
    if (q) setQuery(q)
    /* eslint-enable react-hooks/set-state-in-effect */
    const onSlash = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onSlash)
    return () => window.removeEventListener('keydown', onSlash)
  }, [])

  useRegisterCommands([
    { cmd: 'tag', aliases: ['t'], desc: 'Filter by tag: :tag piano', run: (a) => setTag(a[0] ?? 'all') },
    { cmd: 'view', desc: 'List, grid or collections: :view grid', run: (a) => setView((['list', 'grid', 'collections'].includes(a[0] ?? '') ? a[0] : 'list') as View) },
  ])

  const allTags = useMemo(() => {
    const n = new Map<string, number>()
    for (const c of cards) if (!c.locked) for (const t of c.tags) n.set(t, (n.get(t) ?? 0) + 1)
    return ['all', ...[...n.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)]
  }, [cards])

  const list = useMemo(() => {
    const q = fold(query.trim())
    return cards
      .filter((c) => tag === 'all' || (!c.locked && c.tags.includes(tag)))
      .filter((c) => col === 'all' || c.collection?.slug === col)
      .filter((c) => {
        if (!q) return true
        const hay = c.locked ? `${c.collection?.name ?? ''} diary` : `${c.title} ${c.excerpt} ${c.tags.join(' ')} ${c.collection?.name ?? ''}`
        return fold(hay).includes(q)
      })
      .sort(SORTERS[sort])
  }, [cards, tag, col, query, sort])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cards) if (c.collection) m.set(c.collection.slug, (m.get(c.collection.slug) ?? 0) + 1)
    return m
  }, [cards])
  const colIdx = (slug?: string) => String(collections.findIndex((c) => c.slug === slug) + 1).padStart(2, '0')
  const colName = collections.find((c) => c.slug === col)?.name

  return (
    <>
      <section className="wrap stack-16" style={{ paddingTop: 28 }}>
        <div className="row-12">
          <SearchField inputRef={searchRef} value={query} onChange={setQuery} placeholder="Search posts… try “fret” or “japan”" shortcut="/" />
          <label htmlFor="sort" className="row-8 muted" style={{ fontSize: 14 }}>
            Sort
            <select id="sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
              <option value="az">Title A-Z</option>
              <option value="read">Shortest read</option>
            </select>
          </label>
          <Segmented<View>
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'List' },
              { value: 'grid', label: 'Grid' },
              { value: 'collections', label: 'Collections' },
            ]}
          />
        </div>
        <div role="group" aria-label="Filter by tag" className="row-8">
          {allTags.map((t) => (
            <Chip key={t} selected={tag === t} onClick={() => setTag(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 28, paddingBottom: 72, display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 560px', minWidth: 0 }} className="stack-12">
          <p className="small m0 muted" aria-live="polite">
            {list.length} {list.length === 1 ? 'result' : 'results'}
            {tag !== 'all' ? ` · #${tag}` : ''}
            {colName ? ` · in ${colName}` : ''}
          </p>

          {list.length === 0 ? (
            <div style={{ padding: 32, border: '1px dashed var(--line-strong)', borderRadius: 'var(--radius-lg)' }} className="stack-8">
              <span className="mono muted" style={{ fontSize: 14 }}>
                $ grep -ri &quot;{query}&quot; ./blogs
              </span>
              <span className="lead" style={{ fontSize: 19 }}>
                No matches. Maybe I haven&apos;t written that one yet.
              </span>
            </div>
          ) : view === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--line)' }}>
              {list.map((c) => (
                <PostCard key={c.id} card={c} />
              ))}
            </div>
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
              {list.map((c) => (
                <PostCard key={c.id} card={c} variant="card" index={colIdx(c.collection?.slug)} />
              ))}
            </div>
          ) : (
            <div className="stack-16" style={{ gap: 40 }}>
              {collections
                .map((g) => ({ g, items: list.filter((c) => c.collection?.slug === g.slug) }))
                .filter((x) => x.items.length)
                .map(({ g, items }) => (
                  <div key={g.id} className="stack-12">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, borderBottom: '1px solid var(--ink)', paddingBottom: 10 }}>
                      <span className="mono accent" style={{ fontSize: 14 }}>
                        {colIdx(g.slug)}
                      </span>
                      <h2 className="h3 m0" style={{ fontSize: 28 }}>
                        {g.name}
                      </h2>
                      <span className="small muted" style={{ marginLeft: 'auto' }}>
                        {countLabel(items.length, isPrivateCollection(g))}
                      </span>
                    </div>
                    <p className="m0 muted">{g.description}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                      {items.map((c) => (
                        <PostCard key={c.id} card={c} variant="card" index={colIdx(c.collection?.slug)} showCollection={false} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <aside style={{ flex: '1 1 280px', minWidth: 0 }} className="stack-16" aria-label="Filters and subscribe">
          <div className="box" style={{ padding: 14 }}>
            <h2 style={{ margin: '4px 10px 10px', font: '600 15px/1.4 var(--font-sans)' }}>Collections</h2>
            {[{ slug: 'all', name: 'All writing', n: cards.length }, ...collections.map((c) => ({ slug: c.slug, name: c.name, n: counts.get(c.slug) ?? 0 }))].map((c) => (
              <button key={c.slug} type="button" className={col === c.slug ? 'side on' : 'side'} aria-pressed={col === c.slug} onClick={() => setCol(c.slug)}>
                <span>{c.name}</span>
                <span className="small muted">{c.n}</span>
              </button>
            ))}
          </div>
          <div className="box stack-12" style={{ padding: 18 }}>
            <h2 className="m0" style={{ font: '600 15px/1.4 var(--font-sans)' }}>
              Who can read what
            </h2>
            <span className="row-8" style={{ fontSize: 14, gap: 10 }}>
              <VisibilityBadge mode="members" />
              subscribers who signed in
            </span>
            <span className="row-8" style={{ fontSize: 14, gap: 10 }}>
              <VisibilityBadge mode="shared" />
              only invited accounts
            </span>
            <span className="row-8" style={{ fontSize: 14, gap: 10 }}>
              <VisibilityBadge mode="private" />
              just me, the author
            </span>
          </div>
          <SubscribeBand id="subscribe" compact cta="Subscribe" title="Get new posts by email" description="One email per new post. No spam, unsubscribe anytime." topics={topics} />
          <a href="/rss.xml" className="row-8" style={{ fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '4px 6px' }}>
            <Icon name="rss" size={16} />
            RSS feed
          </a>
        </aside>
      </section>
    </>
  )
}
