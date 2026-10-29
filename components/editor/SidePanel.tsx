'use client'
import { useState } from 'react'
import { Button, Chip } from '@/components/ds/primitives'
import { Segmented } from '@/components/ds/Segmented'
import { VisibilityPicker } from '@/components/ds/VisibilityPicker'
import type { Visibility } from '@/lib/db/schema'
import { formatDate, formatTime } from '@/lib/format'
import type { Meta, Revision } from './types'

export type RightTab = 'settings' | 'share' | 'history'

const REASON: Record<string, string> = { autosave: 'Autosaved', manual: 'Saved by hand', publish: 'Published', restore: 'Restored' }
const VIS_HINT: Record<Visibility, string> = {
  public: 'Anyone can read it.',
  unlisted: 'Only people with the link.',
  members: 'Signed-in subscribers only.',
  shared: 'Only the people you add.',
  private: 'Only you.',
}

export function SidePanel(props: {
  tab: RightTab
  setTab: (t: RightTab) => void
  meta: Meta
  setMeta: (m: Partial<Meta>) => void
  collections: { id: string; name: string; slug: string }[]
  when: 'now' | 'schedule'
  setWhen: (w: 'now' | 'schedule') => void
  whenAt: string
  setWhenAt: (v: string) => void
  visibility: Visibility
  setVisibility: (v: Visibility) => void
  shared: { id: string; email: string }[]
  addShare: (email: string) => void
  removeShare: (id: string) => void
  link: string | null
  emailed: boolean
  revisions: Revision[]
  restore: (id: string) => void
  exportMd: () => void
  busy: boolean
}) {
  const { meta, setMeta } = props
  const [tagDraft, setTagDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const diary = meta.kind === 'diary'
  const canEmail = props.visibility === 'public' && !diary

  return (
    <aside className="ptab" aria-label="Post settings">
      <Segmented<RightTab>
        label="Side panel"
        value={props.tab}
        onChange={props.setTab}
        options={[
          { value: 'settings', label: 'Settings' },
          { value: 'share', label: 'Share' },
          { value: 'history', label: 'History' },
        ]}
      />

      {props.tab === 'settings' ? (
        <div className="stack-16">
          <div className="fld">
            <span>Type</span>
            <div className="row-8" style={{ gap: 6 }}>
              <Chip prefix="" selected={!diary} onClick={() => setMeta({ kind: 'blog' })}>
                Blog post
              </Chip>
              <Chip prefix="" selected={diary} onClick={() => setMeta({ kind: 'diary' })}>
                Diary entry
              </Chip>
            </div>
          </div>
          <label className="fld">
            <span>Collection</span>
            <select className="inp" value={meta.collectionId ?? ''} onChange={(e) => setMeta({ collectionId: e.target.value || null })}>
              <option value="">None</option>
              {props.collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="fld">
            <span>Tags</span>
            <div className="row-8" style={{ gap: 6 }}>
              {meta.tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                  <button type="button" className="tagx" aria-label={`Remove tag ${t}`} onClick={() => setMeta({ tags: meta.tags.filter((x) => x !== t) })}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <label className="ct-sr" htmlFor="newtag">
              Add a tag
            </label>
            <input
              id="newtag"
              className="inp"
              placeholder="Add a tag, press Enter"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const v = tagDraft.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
                if (v && !meta.tags.includes(v) && meta.tags.length < 12) setMeta({ tags: [...meta.tags, v] })
                setTagDraft('')
              }}
            />
          </div>
          <label className="fld">
            <span>URL</span>
            <input
              className="inp mono"
              style={{ fontSize: 13 }}
              value={meta.slug}
              onChange={(e) => setMeta({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') })}
            />
          </label>
          <label className="fld">
            <span>Excerpt</span>
            <textarea className="inp" maxLength={300} value={meta.excerpt} onChange={(e) => setMeta({ excerpt: e.target.value })} />
            <span className="small muted">{meta.excerpt.length} / 160, shown on cards and in the email</span>
          </label>
          <label className="fld">
            <span>Publish</span>
            <select className="inp" value={props.when} onChange={(e) => props.setWhen(e.target.value as 'now' | 'schedule')}>
              <option value="now">As soon as I press Publish</option>
              <option value="schedule">On a date I pick</option>
            </select>
          </label>
          {props.when === 'schedule' ? (
            <label className="fld">
              <span>Date and time (Japan time)</span>
              <input className="inp" type="datetime-local" value={props.whenAt} onChange={(e) => props.setWhenAt(e.target.value)} />
            </label>
          ) : null}
          <Button variant="ghost" size="sm" icon="copy" onClick={props.exportMd}>
            Export Markdown
          </Button>
        </div>
      ) : null}

      {props.tab === 'share' ? (
        <div className="stack-16">
          <VisibilityPicker value={props.visibility} onChange={props.setVisibility} sharedWith={props.shared} onAdd={props.addShare} onRemove={props.removeShare} disabled={props.busy} />
          {props.link ? (
            <div className="fld">
              <span>Link</span>
              <div className="row-8" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <label className="ct-sr" htmlFor="plink">
                  Post link
                </label>
                <input id="plink" className="inp mono" readOnly value={props.link} style={{ fontSize: 12 }} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(props.link!)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          ) : null}
          <label className="toggle-row" style={{ minHeight: 44 }}>
            <span className="stack-8" style={{ gap: 0 }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>Email subscribers</span>
              <span className="small muted">
                {props.emailed
                  ? 'Already emailed when it was first published.'
                  : canEmail
                    ? 'One email when this goes live.'
                    : diary
                      ? 'Diary entries are never emailed.'
                      : `Only public posts are emailed. ${VIS_HINT[props.visibility]}`}
              </span>
            </span>
            <input
              type="checkbox"
              className="check"
              style={{ width: 20, height: 20 }}
              checked={meta.notifyOnPublish && canEmail && !props.emailed}
              disabled={!canEmail || props.emailed}
              onChange={() => setMeta({ notifyOnPublish: !meta.notifyOnPublish })}
            />
          </label>
        </div>
      ) : null}

      {props.tab === 'history' ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <p className="small muted" style={{ margin: '0 0 10px' }}>
            Drafts save automatically a second after you stop typing. Restore any version below.
          </p>
          {props.revisions.map((v, i) => (
            <div key={v.id} className="ver">
              <span className="mono muted" style={{ flex: '0 0 92px' }}>
                {formatDate(v.createdAt, { year: false })} {formatTime(v.createdAt).slice(0, 5)}
              </span>
              <span style={{ flex: 1 }}>
                {REASON[v.reason] ?? v.reason} <span className="muted">v{v.version}</span>
              </span>
              {i === 0 ? (
                <span className="small accent" style={{ fontWeight: 600 }}>
                  Latest
                </span>
              ) : (
                <button type="button" className="tb accent" style={{ minHeight: 32, fontSize: 13 }} disabled={props.busy} onClick={() => props.restore(v.id)}>
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
