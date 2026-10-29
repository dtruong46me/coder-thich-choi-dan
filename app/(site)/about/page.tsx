import type { Metadata } from 'next'
import { Icon } from '@/components/ds/Icon'
import { Button } from '@/components/ds/primitives'
import { AboutTerminal } from '@/components/site/AboutTerminal'
import { ABOUT } from '@/content/about'
import { getSettings } from '@/lib/db/queries/public'
import { socialsWith } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About',
  description: 'A coder who plays guitar and piano. Bách Khoa alum, now living in Japan.',
}

export default async function AboutPage() {
  const settings = await getSettings()
  return (
    <>
      <section className="wrap hero-grid about-hero" style={{ paddingBottom: 96 }}>
        <div className="stack-16" style={{ gap: 22 }}>
          <h1 className="h1 in m0" style={{ fontSize: 'clamp(42px, 5.2vw, 68px)', lineHeight: 1.06 }}>
            Hi, I&apos;m Dinh Truong.
          </h1>
          <p className="lead in d1 m0 muted" style={{ maxWidth: '34ch' }}>
            A coder who plays guitar and piano. Bách Khoa alum, now living in Japan.
          </p>
          <div className="in d2 row-8" style={{ gap: 10 }}>
            <Button href={ABOUT.cvUrl}>Download CV</Button>
            <Button variant="ghost" href="#contact">
              Say hi
            </Button>
          </div>
        </div>
        <div className="in d3" style={{ minWidth: 0 }}>
          <AboutTerminal />
        </div>
      </section>

      <section className="wrap section reveal">
        <h2 className="h2" style={{ margin: '0 0 32px' }}>
          About me, in two languages
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '40px 64px' }}>
          <article lang="en" className="stack-12" style={{ gap: 14, maxWidth: '60ch' }}>
            <span className="accent" style={{ fontWeight: 600 }}>
              English
            </span>
            {ABOUT.intro.en.map((p) => (
              <p key={p} className="prose m0">
                {p}
              </p>
            ))}
          </article>
          <article lang="vi" className="stack-12" style={{ gap: 14, maxWidth: '60ch' }}>
            <span className="accent" style={{ fontWeight: 600 }}>
              Tiếng Việt
            </span>
            {ABOUT.intro.vi.map((p) => (
              <p key={p} className="prose m0">
                {p}
              </p>
            ))}
          </article>
        </div>
      </section>

      <section className="reveal" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div className="wrap" style={{ paddingTop: 72, paddingBottom: 72, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '48px 72px' }}>
          <div className="stack-16" style={{ gap: 28 }}>
            <h2 className="h2 m0">CV</h2>
            {ABOUT.timeline.map((x) => (
              <div key={x.when + x.role} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 16 }}>
                <span className="mono muted" style={{ fontSize: 13, paddingTop: 6 }}>
                  {x.when}
                </span>
                <span className="stack-8" style={{ gap: 2 }}>
                  <span lang={x.lang} style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.25 }}>
                    {x.role}
                  </span>
                  <span className="muted">{x.where}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="stack-16" style={{ gap: 32, paddingTop: 6 }}>
            <div className="stack-12">
              <h3 className="h3 m0" style={{ fontSize: 20 }}>
                Skills
              </h3>
              <div className="row-8" style={{ gap: 6 }}>
                {ABOUT.skills.map((s) => (
                  <span key={s} className="mono" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="stack-12">
              <h3 className="h3 m0" style={{ fontSize: 20 }}>
                Languages
              </h3>
              <dl className="dl">
                {ABOUT.languages.map(([k, v, lang]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt lang={lang}>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="stack-12">
              <h3 className="h3 m0" style={{ fontSize: 20 }}>
                Music
              </h3>
              <dl className="dl">
                {ABOUT.music.map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="wrap reveal" style={{ paddingTop: 96, paddingBottom: 96 }}>
        <div className="stack-8" style={{ marginBottom: 32, maxWidth: '48ch' }}>
          <h2 className="h2 m0">Say hi</h2>
          <p className="m0 muted" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.55 }}>
            For work, a collaboration, or a song you think I should learn.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
          {socialsWith(settings.socials).map((c) => (
            <a key={c.icon} className="contact" href={c.href}>
              <Icon name={c.icon} size={20} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                <span style={{ fontWeight: 600 }}>{c.label}</span>
                <span className="muted" style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.handle}
                </span>
              </span>
              <Icon name="arrow-right" size={20} />
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
