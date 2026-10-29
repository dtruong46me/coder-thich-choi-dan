'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Chip, StatusPill } from '@/components/ds/primitives'
import type { ProjectCard } from '@/lib/db/queries/public'
import { useRegisterCommands } from './CommandLine'

const KINDS: Record<string, string> = { web: 'Web', music: 'Music tool', cli: 'CLI', course: 'Coursework' }
const FILTERS = [
  ['all', 'All'],
  ['web', 'Web'],
  ['music', 'Music tools'],
  ['cli', 'CLI'],
  ['course', 'Coursework'],
] as const
const STATUS = {
  shipped: ['SHIPPED', 'accent'],
  in_progress: ['IN PROGRESS', 'ochre'],
  archived: ['ARCHIVED', 'muted'],
} as const

export function ProjectsGrid({ projects }: { projects: ProjectCard[] }) {
  const [filter, setFilter] = useState<string>('all')
  useRegisterCommands([{ cmd: 'filter', aliases: ['f'], desc: 'Filter: :filter music, web, cli, course, all', run: (a) => setFilter(a[0] ?? 'all') }])
  const items = projects.filter((p) => filter === 'all' || p.kind === filter)

  return (
    <section className="wrap stack-16" style={{ paddingTop: 48, paddingBottom: 24, gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div role="group" aria-label="Filter projects" className="row-8">
          {FILTERS.map(([k, label]) => (
            <Chip key={k} prefix="" selected={filter === k} onClick={() => setFilter(k)}>
              {label}
            </Chip>
          ))}
        </div>
        <span className="small muted" aria-live="polite">
          {items.length} {items.length === 1 ? 'project' : 'projects'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))', gap: 20 }}>
        {items.map((p) => (
          <article key={p.id} className="pcard stack-12" style={{ padding: 28, minHeight: 230 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="small muted">
                {KINDS[p.kind] ?? p.kind}, {p.year}
              </span>
              <StatusPill tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</StatusPill>
            </span>
            <h3 className="h3 m0">{p.name}</h3>
            <p className="m0 muted" style={{ fontSize: 15, flex: 1 }}>
              {p.description}
            </p>
            <span className="mono muted" style={{ fontSize: 12 }}>
              {p.stack.join(' · ')}
            </span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 18, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              {p.links.map((l) => (
                <a key={l.href} className="plink" href={l.href}>
                  {l.label} →
                </a>
              ))}
              {p.postSlug ? (
                <Link className="plink" href={`/blogs/${p.postSlug}`}>
                  Read the post →
                </Link>
              ) : null}
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}
