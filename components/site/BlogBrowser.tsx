'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PostCard } from '@/components/ds/cards'
import { SearchField } from '@/components/ds/fields'
import { Icon } from '@/components/ds/Icon'
import { Segmented } from '@/components/ds/Segmented'
import { collectionCounts, isPrivateCollection } from '@/lib/collections'
import type { Card, CollectionSummary } from '@/lib/db/queries/public'
import { useRegisterCommands } from './CommandLine'

type Sort = 'new' | 'old' | 'az' | 'read'
type View = 'list' | 'grid'

const PAGE_SIZE = 10
const TAGS_SHOWN = 24
const VIEW_KEY = 'blogs:view'

const SORTERS: Record<Sort, (a: Card, b: Card) => number> = {
  new: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  old: (a, b) => a.publishedAt.localeCompare(b.publishedAt),
  az: (a, b) => (a.locked ? '~' : a.title).localeCompare(b.locked ? '~' : b.title),
  read: (a, b) => (a.locked ? 999 : a.readingMinutes) - (b.locked ? 999 : b.readingMinutes),
}

const fold = (s: string) => s.replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Page numbers to show: first, last, and the current one with its neighbours; null marks a gap. */
function pageWindow(current: number, total: number): (number | null)[] {
  const keep = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total))
  const out: (number | null)[] = []
  for (const n of [...keep].sort((a, b) => a - b)) {
    const prev = out[out.length - 1]
    if (typeof prev === 'number' && n - prev > 1) out.push(n - prev === 2 ? prev + 1 : null)
    out.push(n)
  }
  return out
}

/**
 * Filters run in the browser over the prerendered list: locked cards only carry date and collection.
 * Collection, tag, search, sort and page live in the URL (replaceState), so Back from a post lands on the same page.
 */
export function BlogBrowser({ cards, collections }: { cards: Card[]; collections: CollectionSummary[] }) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('all')
  const [col, setCol] = useState('all')
  const [sort, setSort] = useState<Sort>('new')
  const [view, setView] = useState<View>('list')
  const [page, setPage] = useState(1)
  const [allTagsShown, setAllTagsShown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const listTop = useRef<HTMLDivElement>(null)
  const urlRead = useRef(false)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const c = p.get('collection')
    const t = p.get('tag')
    const q = p.get('q')
    const s = p.get('sort')
    const n = Number(p.get('page'))
    let v: string | null = null
    try {
      v = localStorage.getItem(VIEW_KEY)
    } catch {}
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the URL after hydration */
    if (c) setCol(c)
    if (t) setTag(t)
    if (q) setQuery(q)
    if (s && s in SORTERS) setSort(s as Sort)
    if (Number.isInteger(n) && n > 1) setPage(n)
    if (v === 'list' || v === 'grid') setView(v)
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

  useEffect(() => {
    // The first run still has the defaults, before the URL above has been read into state.
    if (!urlRead.current) {
      urlRead.current = true
      return
    }
    const p = new URLSearchParams()
    if (col !== 'all') p.set('collection', col)
    if (tag !== 'all') p.set('tag', tag)
    if (query.trim()) p.set('q', query.trim())
    if (sort !== 'new') p.set('sort', sort)
    if (page > 1) p.set('page', String(page))
    const qs = p.toString()
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`
    if (url !== window.location.pathname + window.location.search) window.history.replaceState(null, '', url)
  }, [col, tag, query, sort, page])

  // Any change of filter starts again from page 1.
  function filtered<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v)
      setPage(1)
    }
  }
  const pickCol = filtered(setCol)
  const pickTag = filtered(setTag)
  const pickQuery = filtered(setQuery)
  const pickSort = filtered(setSort)
  const pickView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {}
  }

  useRegisterCommands([
    { cmd: 'tag', aliases: ['t'], desc: 'Filter by tag: :tag piano', run: (a) => pickTag(a[0] ?? 'all') },
    {
      cmd: 'view',
      desc: 'List or grid: :view grid',
      run: (a) => pickView(a[0] === 'grid' ? 'grid' : 'list'),
    },
  ])

  const inCollection = useMemo(
    () => cards.filter((c) => col === 'all' || c.collection?.slug === col),
    [cards, col],
  )

  // Tags with counts inside the chosen collection, most used first. The selected tag stays even at zero.
  const tags = useMemo(() => {
    const n = new Map<string, number>()
    for (const c of inCollection) if (!c.locked) for (const t of c.tags) n.set(t, (n.get(t) ?? 0) + 1)
    if (tag !== 'all' && !n.has(tag)) n.set(tag, 0)
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [inCollection, tag])

  const list = useMemo(() => {
    const q = fold(query.trim())
    return inCollection
      .filter((c) => tag === 'all' || (!c.locked && c.tags.includes(tag)))
      .filter((c) => {
        if (!q) return true
        const hay = c.locked
          ? `${c.collection?.name ?? ''} diary`
          : `${c.title} ${c.excerpt} ${c.tags.join(' ')} ${c.collection?.name ?? ''}`
        return fold(hay).includes(q)
      })
      .sort(SORTERS[sort])
  }, [inCollection, tag, query, sort])

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const shown = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  function goTo(n: number) {
    setPage(n)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    listTop.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }

  const counts = useMemo(() => collectionCounts(cards), [cards])
  const colIdx = (slug?: string) => String(collections.findIndex((c) => c.slug === slug) + 1).padStart(2, '0')
  const tabs = [
    { slug: 'all', name: 'All writing', n: cards.length, locked: false },
    ...collections.map((c) => ({
      slug: c.slug,
      name: c.name,
      n: counts.get(c.slug) ?? 0,
      locked: isPrivateCollection(c),
    })),
  ]

  return (
    <>
      <section className="wrap stack-16" style={{ paddingTop: 28 }}>
        <div className="row-12">
          <SearchField
            inputRef={searchRef}
            value={query}
            onChange={pickQuery}
            placeholder="Search posts… try “fret” or “japan”"
            shortcut="/"
          />
          <label htmlFor="sort" className="row-8 muted" style={{ fontSize: 14 }}>
            Sort
            <select
              id="sort"
              className="select"
              value={sort}
              onChange={(e) => pickSort(e.target.value as Sort)}
            >
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
              <option value="az">Title A-Z</option>
              <option value="read">Shortest read</option>
            </select>
          </label>
          <Segmented<View>
            label="View"
            value={view}
            onChange={pickView}
            options={[
              { value: 'list', label: 'List' },
              { value: 'grid', label: 'Grid' },
            ]}
          />
        </div>
        <div role="group" aria-label="Collections" className="col-tabs">
          {tabs.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={col === c.slug ? 'col-tab on' : 'col-tab'}
              aria-pressed={col === c.slug}
              onClick={() => pickCol(c.slug)}
            >
              {c.locked ? <Icon name="lock" size={13} /> : null}
              {c.name}
              <span className="col-tab-n">{c.n}</span>
            </button>
          ))}
        </div>
      </section>

      <section
        className="wrap"
        style={{
          paddingTop: 28,
          paddingBottom: 72,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 48,
          alignItems: 'flex-start',
        }}
      >
        <div
          ref={listTop}
          style={{ flex: '999 1 560px', minWidth: 0, scrollMarginTop: 24 }}
          className="stack-12"
        >
          <p className="small m0 muted" aria-live="polite">
            {list.length} {list.length === 1 ? 'result' : 'results'}
            {tag !== 'all' ? ` · #${tag}` : ''}
            {pages > 1 ? ` · page ${current} of ${pages}` : ''}
          </p>

          {list.length === 0 ? (
            <div
              style={{
                padding: 32,
                border: '1px dashed var(--line-strong)',
                borderRadius: 'var(--radius-lg)',
              }}
              className="stack-8"
            >
              <span className="mono muted" style={{ fontSize: 14 }}>
                $ grep -ri &quot;{query || tag}&quot; ./blogs
              </span>
              <span className="lead" style={{ fontSize: 19 }}>
                No matches. Maybe I haven&apos;t written that one yet.
              </span>
            </div>
          ) : view === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--line)' }}>
              {shown.map((c) => (
                <PostCard key={c.id} card={c} />
              ))}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 16,
              }}
            >
              {shown.map((c) => (
                <PostCard key={c.id} card={c} variant="card" index={colIdx(c.collection?.slug)} />
              ))}
            </div>
          )}

          {pages > 1 ? (
            <nav className="pager" aria-label="Pages">
              <button
                type="button"
                className="pager-btn"
                disabled={current === 1}
                onClick={() => goTo(current - 1)}
              >
                <Icon name="arrow-left" size={16} />
                <span className="pager-word">Previous</span>
              </button>
              {pageWindow(current, pages).map((n, i) =>
                n === null ? (
                  <span key={`gap${i}`} className="pager-gap" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={n === current ? 'pager-btn on' : 'pager-btn'}
                    aria-label={`Page ${n}`}
                    aria-current={n === current ? 'page' : undefined}
                    onClick={() => goTo(n)}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                className="pager-btn"
                disabled={current === pages}
                onClick={() => goTo(current + 1)}
              >
                <span className="pager-word">Next</span>
                <Icon name="arrow-right" size={16} />
              </button>
            </nav>
          ) : null}
        </div>

        <aside style={{ flex: '1 1 300px', minWidth: 0 }} className="stack-16" aria-label="Tags">
          {tags.length ? (
            <div className="box tag-box">
              <div className="tag-box-head">
                <h2>Tags</h2>
                {tag !== 'all' ? (
                  <button type="button" className="tag-clear" onClick={() => pickTag('all')}>
                    Clear
                    <Icon name="x" size={13} />
                  </button>
                ) : null}
              </div>
              {/* Most-used first, so the cloud reads from the big topics down to the one-offs. */}
              <div role="group" aria-label="Filter by tag" className="tag-cloud">
                {(allTagsShown ? tags : tags.slice(0, TAGS_SHOWN)).map(([t, n]) => (
                  <button
                    key={t}
                    type="button"
                    className={tag === t ? 'tag-pill on' : 'tag-pill'}
                    aria-pressed={tag === t}
                    onClick={() => pickTag(tag === t ? 'all' : t)}
                  >
                    <span className="tag-hash" aria-hidden="true">
                      #
                    </span>
                    {t}
                    <span className="tag-n">{n}</span>
                  </button>
                ))}
              </div>
              {tags.length > TAGS_SHOWN ? (
                <button type="button" className="side-more" onClick={() => setAllTagsShown((v) => !v)}>
                  {allTagsShown ? 'Show fewer' : `Show all ${tags.length} tags`}
                </button>
              ) : null}
            </div>
          ) : null}
          <a
            href="/rss.xml"
            className="row-8 small"
            style={{ fontWeight: 500, textDecoration: 'none', padding: '0 6px' }}
          >
            <Icon name="rss" size={15} />
            RSS feed
          </a>
        </aside>
      </section>
    </>
  )
}
