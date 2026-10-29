import type { Metadata } from 'next'
import { Button } from '@/components/ds/primitives'
import { HeroPlayer } from '@/components/site/HeroPlayer'
import { ProjectsGrid } from '@/components/site/ProjectsGrid'
import { NOW } from '@/content/now'
import { getProjects } from '@/lib/db/queries/public'

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Small tools for musicians, web experiments, and coursework from Bách Khoa.',
}

const KIND_LABEL: Record<string, string> = { web: 'Web', music: 'Music tool', cli: 'CLI', course: 'Coursework' }
const STATUS = { shipped: 'shipped', in_progress: 'in progress', archived: 'archived' } as const

export default async function ProjectsPage() {
  const projects = await getProjects()
  const hero = projects.find((p) => p.featured)
  const others = projects.filter((p) => p.id !== hero?.id)

  return (
    <>
      <section className="wrap stack-12" style={{ paddingTop: 56, paddingBottom: 8, gap: 14 }}>
        <p className="kicker-path">
          <span className="accent">~/projects</span> $ git log --oneline | head
        </p>
        <h1 className="h1 m0" style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>
          Things I&apos;ve built
        </h1>
        <p className="lead m0 muted" style={{ maxWidth: '44ch' }}>
          Small tools for musicians, web experiments, and coursework from Bách Khoa. Most started as a blog post.
        </p>
      </section>

      {hero ? (
        <section className="wrap" style={{ paddingTop: 40 }}>
          <article className="pcard" style={{ display: 'flex', flexWrap: 'wrap', overflow: 'hidden' }}>
            <div style={{ flex: '1 1 440px', minWidth: 0, padding: 'clamp(24px, 4vw, 44px)' }} className="stack-16">
              <span className="small muted">
                {KIND_LABEL[hero.kind] ?? hero.kind} · {STATUS[hero.status]}
              </span>
              <h2 className="h2 m0">{hero.name}</h2>
              <p className="lead m0 muted" style={{ fontSize: 19 }}>
                {hero.description}
              </p>
              <span className="row-8" style={{ gap: 6 }}>
                {hero.stack.map((s) => (
                  <span key={s} className="stack-tag">
                    {s}
                  </span>
                ))}
              </span>
              <div className="row-8" style={{ gap: 10, marginTop: 4 }}>
                {hero.links.map((l, i) => (
                  <Button key={l.href} href={l.href} variant={i === 0 ? 'primary' : 'ghost'} icon={l.label === 'Source' ? 'github' : undefined} iconRight={i === 0 ? 'arrow-right' : undefined}>
                    {l.label}
                  </Button>
                ))}
              </div>
            </div>
            <div
              style={{ flex: '1 1 440px', minWidth: 0, background: 'var(--surface-2)', padding: 'clamp(20px, 3vw, 40px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <HeroPlayer size={320} simple />
            </div>
          </article>
        </section>
      ) : null}

      <ProjectsGrid projects={others} />

      <section className="wrap" style={{ paddingTop: 48, paddingBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 40 }}>
        <div style={{ flex: '1 1 300px' }} className="stack-8">
          <h2 className="h2 m0">Now working on</h2>
          <p className="lead m0 muted" style={{ fontSize: 18 }}>
            What I&apos;m building this month. Ideas welcome.
          </p>
        </div>
        <ol style={{ flex: '2 1 520px', margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
          {NOW.map((n) => (
            <li key={n.title} style={{ display: 'flex', gap: 20, padding: '18px 0', borderTop: '1px solid var(--line)' }}>
              <span className="mono muted" style={{ flex: '0 0 90px', fontSize: 13, paddingTop: 3 }}>
                {n.when}
              </span>
              <span className="stack-8" style={{ gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500 }}>{n.title}</span>
                <span className="muted">{n.note}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap" style={{ paddingTop: 40, paddingBottom: 72 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 'var(--radius-xl)',
            padding: 'clamp(24px, 4vw, 44px)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
          }}
        >
          <div className="stack-8" style={{ flex: '1 1 360px' }}>
            <h2 className="m0" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(28px, 3.4vw, 42px)', lineHeight: 1.05, letterSpacing: '-.02em' }}>
              Got an idea, or found a bug?
            </h2>
            <p className="m0" style={{ fontFamily: 'var(--font-serif)', fontSize: 19 }}>
              I&apos;m always up for a small collaboration, especially anything with music in it.
            </p>
          </div>
          <div className="row-8" style={{ gap: 10 }}>
            <a href="mailto:hello@coderthichchoidan.dev" className="cta-solid">
              Say hi
            </a>
            <a href="https://github.com/coderthichchoidan" className="cta-outline">
              GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
