import Link from 'next/link'
import { Suspense } from 'react'
import { EmailDefaultToggle } from '@/components/admin/EmailDefaultToggle'
import { Icon } from '@/components/ds/Icon'
import { StatusPill, VisibilityBadge } from '@/components/ds/primitives'
import { requireOwnerPage } from '@/lib/access'
import { createPost } from '@/lib/actions/posts'
import { getDashboard } from '@/lib/db/queries/admin'
import { formatDate } from '@/lib/format'

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Dashboard />
    </Suspense>
  )
}

function greeting(now: Date) {
  const h = Number(now.toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', hour12: false }))
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function savedLabel(d: { status: string; updatedAt: Date; scheduledAt: Date | null }) {
  if (d.status === 'scheduled' && d.scheduledAt)
    return `Goes live ${formatDate(d.scheduledAt, { year: false })}, ${d.scheduledAt.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })}`
  const mins = Math.round((Date.now() - d.updatedAt.getTime()) / 60_000)
  if (mins < 1) return 'Autosaved just now'
  if (mins < 60) return `Autosaved ${mins} minute${mins === 1 ? '' : 's'} ago`
  return `Autosaved ${formatDate(d.updatedAt, { year: false })}`
}

async function Dashboard() {
  const owner = await requireOwnerPage()
  const data = await getDashboard(owner.userId)
  const now = new Date()
  const today = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Tokyo', weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="stack-16" style={{ gap: 32, maxWidth: 1080 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div className="stack-8" style={{ gap: 4 }}>
          <span className="small muted">{today}</span>
          <h1 className="h1 m0" style={{ fontSize: 'clamp(34px, 3.6vw, 46px)' }}>
            {greeting(now)}, Trường.
          </h1>
        </div>
        <div className="row-8" style={{ gap: 10 }}>
          <form action={createPost}>
            <input type="hidden" name="kind" value="diary" />
            <button type="submit" className="ct-btn ct-btn-ghost ct-btn-md">
              <Icon name="lock" size={17} />
              <span>New diary entry</span>
            </button>
          </form>
          <form action={createPost}>
            <input type="hidden" name="kind" value="blog" />
            <button type="submit" className="ct-btn ct-btn-primary ct-btn-md">
              <span>New post</span>
            </button>
          </form>
        </div>
      </div>

      <section className="stack-12">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h2 className="h3 m0" style={{ fontSize: 22 }}>
            Continue writing
          </h2>
          <Link href="/admin/posts?tab=draft" style={{ fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            All drafts
          </Link>
        </div>
        <div className="panel" style={{ overflow: 'hidden' }}>
          {data.drafts.length ? (
            data.drafts.map((d) => (
              <Link key={d.id} className="draft" href={`/admin/editor/${d.id}`}>
                <span style={{ flex: '1 1 320px', minWidth: 0 }} className="stack-8">
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>{d.title || 'Untitled'}</span>
                  <span className="small muted">
                    {d.collection ?? 'No collection'}, {d.wordCount.toLocaleString('en-US')} words. {savedLabel(d)}
                  </span>
                </span>
                <StatusPill tone={d.status === 'scheduled' ? 'ochre' : 'muted'}>{d.status === 'scheduled' ? 'Scheduled' : 'Draft'}</StatusPill>
                <span className="open muted" style={{ fontWeight: 500, fontSize: 14 }}>
                  Open in editor →
                </span>
              </Link>
            ))
          ) : (
            <p className="m0 muted" style={{ padding: 20 }}>
              No drafts. Start one with New post.
            </p>
          )}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '32px 48px' }}>
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="h3" style={{ margin: '0 0 8px', fontSize: 20 }}>
            Recently published
          </h2>
          {data.recent.map((r) => (
            <Link key={r.id} className="arow" href={`/admin/editor/${r.id}`}>
              <span className="mono muted" style={{ flex: '0 0 56px', fontSize: 12 }}>
                {formatDate(r.publishedAt, { year: false })}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>{r.title}</span>
              <VisibilityBadge mode={r.visibility} count={r.sharedCount} />
            </Link>
          ))}
          {!data.recent.length ? <p className="muted">Nothing published yet.</p> : null}
        </section>

        <section className="stack-16">
          <h2 className="h3 m0" style={{ fontSize: 20 }}>
            At a glance
          </h2>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '10px 16px', fontSize: 15 }}>
            {[
              ['Published posts', data.stats.published],
              ['Drafts', data.stats.drafts],
              ['Scheduled', data.stats.scheduled],
              ['Diary entries', data.stats.diary],
              ['Subscribers', data.stats.subscribers],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt className="muted">{k}</dt>
                <dd className="mono" style={{ margin: 0, textAlign: 'right' }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <EmailDefaultToggle initial={data.emailOnPublishDefault} />
        </section>
      </div>
    </div>
  )
}
