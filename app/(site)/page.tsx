import Link from 'next/link'
import { PostCard } from '@/components/ds/cards'
import { DotGlobe } from '@/components/ds/DotGlobe'
import { Icon } from '@/components/ds/Icon'
import { Button } from '@/components/ds/primitives'
import { SubscribeBand } from '@/components/ds/SubscribeBand'
import { Fretboard } from '@/components/site/Fretboard'
import { HeroPlayer } from '@/components/site/HeroPlayer'
import { collectionCounts, countLabel, isPrivateCollection } from '@/lib/collections'
import { getCollections, getListing, getProjects, type OpenCard } from '@/lib/db/queries/public'
import { formatDate } from '@/lib/format'
import { TOPICS } from '@/lib/site'

const STATUS_LABEL = { shipped: 'shipped', in_progress: 'in progress', archived: 'archived' } as const
const KIND_LABEL: Record<string, string> = { web: 'Web', music: 'Music tool', cli: 'CLI', course: 'Coursework' }

export default async function HomePage() {
  const [cards, collections, projects] = await Promise.all([getListing(), getCollections(), getProjects()])
  const featured = cards.find((c): c is OpenCard => !c.locked && c.kind === 'blog')
  const latest = cards.filter((c) => c.id !== featured?.id).slice(0, 4)
  const counts = collectionCounts(cards)
  const tiles = projects.filter((p) => p.featured).slice(0, 3)

  return (
    <>
      <section className="wrap hero-grid">
        <div className="stack-16" style={{ gap: 24 }}>
          <h1 className="hero in m0">
            Coder thích chơi <span className="accent">đàn.</span>
          </h1>
          <p className="lead in d1 m0 muted" style={{ maxWidth: '30ch' }}>
            I write code by day and play guitar and piano by night. These are my notes.
          </p>
          <div className="in d2 row-12">
            <Button href="/blogs" iconRight="arrow-right">
              Read the blog
            </Button>
            <Button variant="ghost" href="/about">
              About me
            </Button>
          </div>
        </div>
        <div className="in d3">
          <HeroPlayer size={420} />
        </div>
      </section>

      <section className="wrap section reveal">
        <h2 className="h2" style={{ margin: '0 0 32px' }}>
          Latest writing
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 40, alignItems: 'start' }}>
          {featured ? (
            <Link className="feat" href={`/blogs/${featured.slug}`}>
              <Fretboard />
              <span className="small" style={{ marginTop: 20 }}>
                <span className="accent" style={{ fontWeight: 600 }}>
                  {featured.collection?.name}
                </span>{' '}
                <span className="muted">{formatDate(featured.publishedAt)}</span>
              </span>
              <span className="h3 ft" style={{ marginTop: 6, fontSize: 'clamp(24px, 2.4vw, 30px)', lineHeight: 1.2 }}>
                {featured.title}
              </span>
              {featured.excerpt ? (
                <span style={{ marginTop: 10, fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.55, color: 'var(--ink-muted)', maxWidth: '52ch' }}>
                  {featured.excerpt}
                </span>
              ) : null}
            </Link>
          ) : (
            <p className="lead muted">Nothing published yet. The first post is on its way.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--line)' }}>
            {latest.map((c) => (
              <PostCard key={c.id} card={c} />
            ))}
          </div>
        </div>
      </section>

      {tiles.length ? (
        <section className="wrap section reveal">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 32 }}>
            <h2 className="h2 m0">Projects</h2>
            <Button variant="quiet" href="/projects" iconRight="arrow-right">
              All projects
            </Button>
          </div>
          <div className="bento">
            {tiles.map((p, i) =>
              i === 0 ? (
                <Link key={p.id} className="tile big" href="/projects" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                  <span
                    aria-hidden="true"
                    style={
                      {
                        position: 'absolute',
                        right: -60,
                        top: -60,
                        width: 380,
                        opacity: 0.45,
                        '--accent': 'var(--on-accent)',
                        '--ochre': 'var(--on-accent)',
                        '--line-strong': 'transparent',
                      } as React.CSSProperties
                    }
                  >
                    <DotGlobe size={380} count={90} />
                  </span>
                  <span style={{ position: 'relative', fontSize: 14, fontWeight: 500 }}>
                    {KIND_LABEL[p.kind] ?? p.kind}, {STATUS_LABEL[p.status]}
                  </span>
                  <span style={{ position: 'relative', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(30px, 3.2vw, 42px)', lineHeight: 1.08, letterSpacing: '-.02em' }}>
                    {p.name}
                  </span>
                  <span style={{ position: 'relative', maxWidth: '40ch', fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.5 }}>{p.description}</span>
                </Link>
              ) : p.kind === 'cli' ? (
                <Link key={p.id} className="tile" href="/projects" style={{ background: 'var(--code-bg)', color: 'var(--code-ink)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--syn-string)' }}>$ {p.slug} --help</span>
                  <span className="h3 m0" style={{ color: 'var(--code-ink)' }}>
                    {p.name}
                  </span>
                  <span style={{ color: 'var(--code-muted)' }}>{p.description}</span>
                </Link>
              ) : (
                <Link key={p.id} className="tile" href="/projects" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {KIND_LABEL[p.kind] ?? p.kind}, {STATUS_LABEL[p.status]}
                  </span>
                  <span className="h3 m0">{p.name}</span>
                  <span className="muted">{p.description}</span>
                </Link>
              ),
            )}
          </div>
        </section>
      ) : null}

      <section
        className="wrap section reveal"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px 64px' }}
      >
        <div className="stack-12" style={{ maxWidth: '34ch' }}>
          <h2 className="h2 m0">Browse by topic</h2>
          <p className="m0 muted" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.55 }}>
            {collections.length} shelves. The diary is locked unless I&apos;ve shared a page with you.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', columnGap: 40, borderTop: '1px solid var(--line)' }}>
          {collections.map((c, i) => (
            <Link key={c.id} className="topic" href={`/blogs?collection=${c.slug}`}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent)', flex: 'none', width: 24 }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 500, lineHeight: 1.2 }}>{c.name}</span>
                <span className="small muted">{countLabel(counts.get(c.slug) ?? 0, isPrivateCollection(c))}</span>
              </span>
              {isPrivateCollection(c) ? <Icon name="lock" size={16} label="Private" /> : null}
              <span className="arw" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap reveal" style={{ paddingBottom: 88 }}>
        <SubscribeBand
          id="subscribe"
          title="Get new posts by email"
          description="One email when a public post goes live. Diary pages are never sent."
          cta="Subscribe"
          topics={[...TOPICS]}
        />
      </section>
    </>
  )
}
