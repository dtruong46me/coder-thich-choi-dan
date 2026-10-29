'use client'
import { EditorContent, useEditor, useEditorState, type Editor as TiptapEditor } from '@tiptap/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Button, VisibilityBadge } from '@/components/ds/primitives'
import { Segmented } from '@/components/ds/Segmented'
import { ThemeToggle } from '@/components/ds/ThemeToggle'
import { OpenCommandButton, useRegisterCommands } from '@/components/site/CommandLine'
import { grantAccess, newPost, publishPost, restoreRevision, revokeAccess, schedulePost, setVisibility } from '@/lib/actions/posts'
import { docToMarkdown, markdownToDoc } from '@/lib/content/markdown'
import { countWords, docToText, readingMinutes } from '@/lib/content/text'
import type { Doc } from '@/lib/content/types'
import type { Visibility } from '@/lib/db/schema'
import { formatTime } from '@/lib/format'
import { slugify } from '@/lib/slug'
import { filterBlocks, type BlockDef } from './blocks'
import { buildExtensions } from './extensions'
import { Ribbon } from './Ribbon'
import { SidePanel, type RightTab } from './SidePanel'
import type { EditorData, Meta } from './types'
import { uploadImage } from './upload'
import { discardLocalCopy, findLocalCopy, useAutosave, type LocalCopy } from './useAutosave'

type Mode = 'write' | 'split' | 'preview'
type Slash = { query: string; from: number; to: number; x: number; y: number; sel: number } | null

const LOOKS_LIKE_MD = /^(#{1,6} |[-*+] |\d+\. |> |```|\$\$|\|.+\||- \[[ x]\] )/m

const toTokyoInput = (iso: string | null) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 24 * 3600_000)
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16)
}

export function Editor({ data }: { data: EditorData }) {
  const router = useRouter()
  const { post } = data

  const [title, setTitle] = useState(post.title)
  const [meta, setMetaState] = useState<Meta>({
    slug: post.slug,
    excerpt: post.excerpt,
    collectionId: post.collectionId,
    tags: data.tags,
    kind: post.kind,
    notifyOnPublish: post.notifyOnPublish,
  })
  const [visibility, setVis] = useState<Visibility>(post.visibility)
  const [token, setToken] = useState(post.unlistedToken)
  const [status, setStatus] = useState(post.status)
  const [shared, setShared] = useState(data.grants)
  const [revisions, setRevisions] = useState(data.revisions)
  const [mode, setMode] = useState<Mode>('write')
  const [panel, setPanel] = useState(true)
  const [leftTab, setLeftTab] = useState<'outline' | 'pages'>('outline')
  const [rightTab, setRightTab] = useState<RightTab>('settings')
  const [size, setSize] = useState<'s' | 'm' | 'l'>('m')
  const [wide, setWide] = useState(false)
  const [when, setWhen] = useState<'now' | 'schedule'>(post.status === 'scheduled' ? 'schedule' : 'now')
  const [whenAt, setWhenAt] = useState(toTokyoInput(post.scheduledAt))
  const [md, setMd] = useState('')
  const [slash, setSlash] = useState<Slash>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string; issues?: string[] } | null>(null)
  const [localCopy, setLocalCopy] = useState<LocalCopy | null>(null)
  const [busy, startBusy] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const slashRef = useRef<Slash>(null)
  const editorRef = useRef<TiptapEditor | null>(null)

  const metaRef = useRef(meta)
  const titleRef = useRef(title)
  useEffect(() => {
    metaRef.current = meta
    titleRef.current = title
  })

  const snapshot = useCallback(
    () => ({
      title: titleRef.current,
      // ProseMirror builds attrs with Object.create(null); server action serialization drops such objects,
      // so round-trip through JSON to send plain objects (otherwise every heading level, latex, etc. is lost).
      draftJson: (editorRef.current ? JSON.parse(JSON.stringify(editorRef.current.getJSON())) : post.draftJson) as Doc,
      meta: metaRef.current,
    }),
    [post.draftJson],
  )

  const autosave = useAutosave({
    postId: post.id,
    initialVersion: post.draftVersion,
    initialSavedAt: post.updatedAt,
    getSnapshot: snapshot,
    onSaved: (res) => {
      if (res.slugTaken) setNotice({ tone: 'err', text: 'That URL is taken by another post, so it was not changed.' })
      if (res.slug) setMetaState((m) => (m.slug === res.slug ? m : { ...m, slug: res.slug! }))
    },
  })
  const change = autosave.change

  /* ---------------------------------------------------------------- Images */

  const insertImages = useCallback(
    async (files: File[], at?: number) => {
      const editor = editorRef.current
      if (!editor) return
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        setNotice({ tone: 'ok', text: `Uploading ${file.name}…` })
        try {
          // Diary images go to the private bucket and are served only after a permission check.
          const img = await uploadImage(file, metaRef.current.kind === 'diary' || visibility !== 'public' ? 'private' : 'public')
          const chain = editor.chain().focus()
          ;(at !== undefined ? chain.insertContentAt(at, { type: 'image', attrs: { ...img, alt: '' } }) : chain.insertContent({ type: 'image', attrs: { ...img, alt: '' } })).run()
          setNotice({ tone: 'ok', text: 'Image added. Give it alt text before publishing.' })
        } catch (err) {
          setNotice({ tone: 'err', text: err instanceof Error ? err.message : 'Upload failed.' })
        }
      }
    },
    [visibility],
  )

  /* ---------------------------------------------------------------- Editor */

  const runBlock = useCallback((b: BlockDef) => {
    const editor = editorRef.current
    const s = slashRef.current
    if (!editor) return
    let chain = editor.chain().focus()
    if (s) chain = chain.deleteRange({ from: s.from, to: s.to })
    const res = b.run(chain, editor, { pickImage: () => fileRef.current?.click() })
    ;(res ?? chain).run()
    slashRef.current = null
    setSlash(null)
  }, [])

  const extensions = useMemo(
    () =>
      buildExtensions((latex, pos) => {
        const next = window.prompt('Edit the formula (LaTeX)', latex)
        if (next !== null) editorRef.current?.chain().setNodeSelection(pos).updateInlineMath({ latex: next }).run()
      }),
    [],
  )

  const editor = useEditor({
    extensions,
    content: post.draftJson as Doc,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'doc', 'aria-label': 'Post content' },
      handleKeyDown: (_view, e) => {
        const s = slashRef.current
        if (!s) return false
        const items = filterBlocks(s.query)
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const n = Math.max(1, items.length)
          const sel = (s.sel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
          slashRef.current = { ...s, sel }
          setSlash(slashRef.current)
          return true
        }
        if (e.key === 'Enter') {
          const b = items[Math.min(s.sel, items.length - 1)]
          if (b) runBlock(b)
          return !!b
        }
        if (e.key === 'Escape') {
          slashRef.current = null
          setSlash(null)
          return true
        }
        return false
      },
      handlePaste: (view, e) => {
        const files = [...(e.clipboardData?.files ?? [])]
        if (files.length) {
          void insertImages(files)
          return true
        }
        const text = e.clipboardData?.getData('text/plain') ?? ''
        const html = e.clipboardData?.getData('text/html') ?? ''
        // Pasted Markdown becomes real blocks.
        if (!html && text.includes('\n') && LOOKS_LIKE_MD.test(text)) {
          const { doc } = markdownToDoc(text)
          editorRef.current?.chain().focus().insertContent(doc.content ?? []).run()
          return true
        }
        return false
      },
      handleDrop: (view, e, _slice, moved) => {
        const files = [...(e.dataTransfer?.files ?? [])]
        if (moved || !files.length) return false
        const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos
        void insertImages(files, pos)
        return true
      },
    },
    onUpdate: () => change(),
  })
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  // The "/" menu: open while the cursor is at the end of a paragraph that starts with "/".
  useEffect(() => {
    if (!editor) return
    const check = () => {
      const { $from, empty } = editor.state.selection
      const text = $from.parent.textContent
      if (!empty || $from.parent.type.name !== 'paragraph' || !text.startsWith('/') || $from.parentOffset !== text.length || text.length > 30) {
        if (slashRef.current) {
          slashRef.current = null
          setSlash(null)
        }
        return
      }
      const coords = editor.view.coordsAtPos($from.pos)
      const prev = slashRef.current
      slashRef.current = { query: text.slice(1), from: $from.start(), to: $from.pos, x: coords.left, y: coords.bottom, sel: prev && prev.query === text.slice(1) ? prev.sel : 0 }
      setSlash(slashRef.current)
    }
    editor.on('transaction', check)
    return () => {
      editor.off('transaction', check)
    }
  }, [editor])

  useEffect(() => {
    editor?.setEditable(mode === 'write')
  }, [editor, mode])

  // A newer copy on this device (closed tab while offline)? Offer to bring it back.
  useEffect(() => {
    let alive = true
    void findLocalCopy(post.id, post.updatedAt, { title: post.title, draftJson: post.draftJson, meta: metaRef.current }).then((c) => {
      if (alive) setLocalCopy(c)
    })
    return () => {
      alive = false
    }
  }, [post.id, post.updatedAt, post.title, post.draftJson])

  const outline = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { headings: [] as { text: string; level: number; pos: number }[], words: 0 }
      const headings: { text: string; level: number; pos: number }[] = []
      e.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') headings.push({ text: node.textContent, level: node.attrs.level as number, pos })
        return node.isBlock
      })
      return { headings, words: countWords(docToText(e.getJSON() as Doc)) }
    },
  })

  /* ---------------------------------------------------------------- Meta, visibility, sharing */

  const setMeta = (m: Partial<Meta>) => {
    let next = { ...metaRef.current, ...m }
    if (m.kind === 'diary' && metaRef.current.kind !== 'diary') {
      const diaryCol = data.collections.find((c) => c.slug === 'diary')
      next = { ...next, collectionId: diaryCol?.id ?? next.collectionId, notifyOnPublish: false }
      changeVisibility('private')
    }
    metaRef.current = next
    setMetaState(next)
    change()
  }

  function changeVisibility(v: Visibility, confirmed = false) {
    startBusy(async () => {
      const res = await setVisibility(post.id, v, confirmed)
      if (!res.ok) return setNotice({ tone: 'err', text: res.error })
      if (res.needsConfirm) {
        if (window.confirm('Make this diary entry Public? Anyone will be able to read it. It will still never be emailed.')) changeVisibility(v, true)
        return
      }
      setVis(res.visibility as Visibility)
      setToken(res.unlistedToken)
    })
  }

  const addShare = (email: string) =>
    startBusy(async () => {
      const res = await grantAccess({ email, scope: 'post', postId: post.id })
      if (!res.ok) return setNotice({ tone: 'err', text: res.error })
      setShared((s) => [...s, { id: res.id, email }])
      setNotice({ tone: 'ok', text: `Invite sent to ${email}.` })
    })
  const removeShare = (id: string) =>
    startBusy(async () => {
      const res = await revokeAccess(id)
      if (res.ok) setShared((s) => s.filter((p) => p.id !== id))
    })

  /* ---------------------------------------------------------------- Save, publish, history */

  const saveNow = useCallback(() => void autosave.saveNow(), [autosave])

  async function publish() {
    setNotice(null)
    if (!(await autosave.saveNow())) return setNotice({ tone: 'err', text: 'Save the draft first: it could not be saved.' })
    startBusy(async () => {
      const notify = metaRef.current.notifyOnPublish && visibility === 'public' && metaRef.current.kind === 'blog' && !data.emailed
      if (when === 'schedule') {
        const res = await schedulePost(post.id, `${whenAt}:00+09:00`, notify)
        if (!res.ok) return setNotice({ tone: 'err', text: res.error })
        setStatus('scheduled')
        return setNotice({ tone: 'ok', text: `Scheduled for ${whenAt.replace('T', ' ')} (Japan time).` })
      }
      const res = await publishPost(post.id, notify)
      if (!res.ok) return setNotice({ tone: 'err', text: res.error, issues: res.issues })
      setStatus('published')
      setNotice({ tone: 'ok', text: res.emailed ? 'Published. Subscribers will get an email shortly.' : 'Published.' })
      router.refresh()
    })
  }

  function restore(revisionId: string) {
    if (!window.confirm('Replace the current draft with this version? The current one stays in History.')) return
    startBusy(async () => {
      const res = await restoreRevision(post.id, revisionId)
      if (!res.ok) return setNotice({ tone: 'err', text: res.error })
      setTitle(res.title)
      titleRef.current = res.title
      editorRef.current?.commands.setContent(res.draftJson as Doc, { emitUpdate: false })
      autosave.adopt(res.version, new Date().toISOString())
      setRevisions((r) => [{ id: `restored-${res.version}`, version: res.version, reason: 'restore', createdAt: new Date().toISOString() }, ...r])
    })
  }

  function exportMd() {
    const doc = editorRef.current?.getJSON() as Doc
    const col = data.collections.find((c) => c.id === meta.collectionId)
    const text = docToMarkdown(doc, { title, slug: meta.slug, excerpt: meta.excerpt, collection: col?.name, visibility, tags: meta.tags })
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${meta.slug || 'post'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function enterMode(m: Mode) {
    if (m === 'split' && editorRef.current) setMd(docToMarkdown(editorRef.current.getJSON() as Doc))
    setMode(m)
  }

  // Split view: the Markdown side drives the document, debounced.
  const mdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function onMarkdown(v: string) {
    setMd(v)
    if (mdTimer.current) clearTimeout(mdTimer.current)
    mdTimer.current = setTimeout(() => {
      editorRef.current?.commands.setContent(markdownToDoc(v).doc, { emitUpdate: true })
    }, 400)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveNow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveNow])

  useRegisterCommands([
    { cmd: 'w', aliases: ['write', 'save'], desc: 'Save the draft now', run: () => saveNow() },
    { cmd: 'wq', desc: 'Save and go back to Posts', run: async () => { await autosave.saveNow(); router.push('/admin/posts') } },
    { cmd: 'preview', aliases: ['pv'], desc: 'Read it like a visitor', run: () => enterMode('preview') },
    { cmd: 'split', desc: 'Markdown and preview side by side', run: () => enterMode('split') },
    { cmd: 'edit', aliases: ['e'], desc: 'Back to the block editor', run: () => enterMode('write') },
    { cmd: 'share', desc: 'Visibility and people', run: () => { setPanel(true); setRightTab('share') } },
    { cmd: 'history', desc: 'Autosaved versions', run: () => { setPanel(true); setRightTab('history') } },
    { cmd: 'publish', desc: status === 'published' ? 'Update the live post' : 'Publish this post', run: () => void publish() },
    { cmd: 'new', desc: 'Start a new post', run: async () => { const { id } = await newPost('blog'); router.push(`/admin/editor/${id}`) } },
  ])

  /* ---------------------------------------------------------------- Render */

  const collection = data.collections.find((c) => c.id === meta.collectionId)
  const saveText =
    autosave.status === 'saving'
      ? 'Saving draft…'
      : autosave.status === 'offline'
        ? 'Offline: saved on this device'
        : autosave.status === 'conflict'
          ? 'Conflict: newer version elsewhere'
          : autosave.status === 'error'
            ? `Not saved: ${autosave.error}`
            : `Draft saved at ${formatTime(autosave.savedAt)}`
  const link = visibility === 'unlisted' ? (token ? `${data.siteUrl}/u/${token}` : null) : `${data.siteUrl}/blogs/${meta.slug}`
  const fontPx = { s: '17px', m: '19px', l: '21px' }[size]
  const statusLabel = status === 'published' ? 'Published' : status === 'scheduled' ? 'Scheduled' : status === 'archived' ? 'Archived' : 'Draft'
  const slashItems = slash ? filterBlocks(slash.query) : []
  const grouped = data.collections.map((c) => ({ c, items: data.tree.filter((t) => t.collectionId === c.id) }))

  return (
    <div className="ed">
      <header className="ed-head">
        <Link className="tb" href="/admin/posts">
          <Icon name="arrow-left" size={16} />
          Posts
        </Link>
        <span className="row-8" style={{ minWidth: 0, fontSize: 14, flexWrap: 'nowrap' }}>
          <span className="muted">{collection?.name ?? 'No collection'}</span>
          <span style={{ color: 'var(--line-strong)' }} aria-hidden="true">
            /
          </span>
          <span style={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || 'Untitled'}</span>
        </span>
        <span role="status" aria-live="polite" className={`save-state save-${autosave.status}`}>
          {autosave.status === 'saving' || autosave.status === 'offline' ? <span className="dot" aria-hidden="true" /> : autosave.status === 'saved' ? <Icon name="check" size={14} /> : null}
          {saveText}
        </span>
        <span style={{ flex: 1 }} />
        <Segmented<Mode>
          label="Editor mode"
          value={mode}
          onChange={enterMode}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'split', label: 'Split' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
        <button type="button" className="tb" aria-pressed={panel} onClick={() => setPanel(!panel)} title="Show or hide the side panel">
          <Icon name="panel" size={16} />
          Panel
        </button>
        <OpenCommandButton label="Commands" />
        <ThemeToggle />
        <Button variant="ghost" size="sm" icon="users" onClick={() => { setPanel(true); setRightTab('share') }}>
          Share
        </Button>
        <Button size="sm" onClick={() => void publish()} disabled={busy}>
          {when === 'schedule' && status !== 'published' ? 'Schedule' : status === 'published' ? 'Update' : 'Publish'}
        </Button>
      </header>

      {mode === 'write' && editor ? <Ribbon editor={editor} size={size} setSize={setSize} wide={wide} setWide={setWide} pickImage={() => fileRef.current?.click()} /> : null}

      {notice ? (
        <div className={notice.tone === 'err' ? 'notice err ed-notice' : 'notice ed-notice'} role={notice.tone === 'err' ? 'alert' : 'status'}>
          {notice.text}
          {notice.issues?.length ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {notice.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
          <button type="button" className="tagx" aria-label="Dismiss" onClick={() => setNotice(null)} style={{ marginLeft: 8 }}>
            ×
          </button>
        </div>
      ) : null}

      {localCopy ? (
        <div className="notice ed-notice" role="alert">
          This device has unsaved changes from {formatTime(new Date(localCopy.at))}.{' '}
          <button
            type="button"
            className="mini"
            onClick={() => {
              setTitle(localCopy.title)
              titleRef.current = localCopy.title
              setMetaState(localCopy.meta as Meta)
              metaRef.current = localCopy.meta as Meta
              editorRef.current?.commands.setContent(localCopy.draftJson as Doc, { emitUpdate: false })
              setLocalCopy(null)
              change()
            }}
          >
            Restore them
          </button>{' '}
          <button type="button" className="mini" onClick={() => { void discardLocalCopy(post.id); setLocalCopy(null) }}>
            Discard
          </button>
        </div>
      ) : null}

      {autosave.conflict ? (
        <div className="conflict" role="alertdialog" aria-label="Two versions of this draft">
          <h2 className="h3 m0" style={{ fontSize: 20 }}>
            This draft changed somewhere else
          </h2>
          <p className="m0 muted small">Another tab or device saved a newer version. Pick one to keep; the other stays in History.</p>
          <div className="conflict-cols">
            <div className="panel" style={{ padding: 14 }}>
              <strong>This device</strong>
              <p className="small muted">{autosave.conflict.mine.title || 'Untitled'}</p>
              <p className="conflict-text">{docToText(autosave.conflict.mine.draftJson as Doc).slice(0, 600)}</p>
              <Button size="sm" onClick={() => autosave.resolve('mine', () => {})}>
                Keep this version
              </Button>
            </div>
            <div className="panel" style={{ padding: 14 }}>
              <strong>Saved at {formatTime(autosave.conflict.server.updatedAt)}</strong>
              <p className="small muted">{autosave.conflict.server.title || 'Untitled'}</p>
              <p className="conflict-text">{docToText(autosave.conflict.server.draftJson as Doc).slice(0, 600)}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  autosave.resolve('theirs', (c) => {
                    setTitle(c.title)
                    titleRef.current = c.title
                    editorRef.current?.commands.setContent(c.draftJson as Doc, { emitUpdate: false })
                  })
                }
              >
                Use the newer one
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ed-body">
        <aside aria-label="Contents" className="ed-left">
          <Segmented
            label="Left panel"
            value={leftTab}
            onChange={setLeftTab}
            options={[
              { value: 'outline', label: 'Outline' },
              { value: 'pages', label: 'Pages' },
            ]}
          />
          {leftTab === 'outline' ? (
            <nav aria-label="On this page" className="stack-8" style={{ gap: 2 }}>
              <span className="small muted" style={{ margin: '4px 0 6px' }}>
                On this page
              </span>
              {outline?.headings.length ? (
                outline.headings.map((h) => (
                  <button
                    key={h.pos}
                    type="button"
                    className={h.level >= 3 ? 'oli l3' : 'oli'}
                    onClick={() => {
                      editor?.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run()
                    }}
                  >
                    {h.text || 'Untitled section'}
                  </button>
                ))
              ) : (
                <span className="small muted">Headings you add show up here.</span>
              )}
            </nav>
          ) : (
            <div className="stack-8" style={{ gap: 2 }}>
              {grouped.map(({ c, items }) => (
                <div key={c.id} className="stack-8" style={{ gap: 2 }}>
                  <span className="tree" style={{ fontWeight: 600 }}>
                    {c.name}
                  </span>
                  {items.map((t) => (
                    <Link key={t.id} className={t.id === post.id ? 'tree on' : 'tree'} href={`/admin/editor/${t.id}`} style={{ paddingLeft: 24 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title || 'Untitled'}</span>
                      <span className="small muted" style={{ marginLeft: 'auto' }}>
                        {t.status === 'published' ? (t.visibility === 'public' ? '' : t.visibility) : t.status}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
              <button type="button" className="tree accent" style={{ marginTop: 8, fontWeight: 500 }} onClick={() => void newPost(meta.kind).then(({ id }) => router.push(`/admin/editor/${id}`))}>
                + New page
              </button>
            </div>
          )}
        </aside>

        <main className="ed-main">
          <div className={mode === 'split' ? 'ed-doc ed-split' : wide ? 'ed-doc wide' : 'ed-doc'}>
            {mode === 'split' ? (
              <div className="stack-8" style={{ minWidth: 0 }}>
                <label htmlFor="md" className="small muted">
                  Markdown
                </label>
                <textarea id="md" className="ed-md" value={md} onChange={(e) => onMarkdown(e.target.value)} spellCheck={false} />
              </div>
            ) : null}
            <article className={mode === 'write' ? 'ed-article' : 'ed-article reading'} style={{ fontSize: fontPx }}>
              {mode === 'split' ? <span className="small muted">Preview</span> : null}
              {mode === 'preview' ? (
                <h1 className="ed-title-static">{title || 'Untitled'}</h1>
              ) : (
                <>
                  <label htmlFor="ttl" className="ct-sr">
                    Title
                  </label>
                  <textarea
                    id="ttl"
                    rows={1}
                    className="ed-title"
                    placeholder="Untitled"
                    value={title}
                    onChange={(e) => {
                      const next = e.target.value
                      // Until the first publish, the URL follows the title (unless it was edited by hand).
                      const m = metaRef.current
                      if (!post.publishedAt && (/^(untitled|diary-\d{4})/.test(m.slug) || m.slug === slugify(titleRef.current))) {
                        const slug = slugify(next)
                        if (slug) {
                          metaRef.current = { ...m, slug }
                          setMetaState(metaRef.current)
                        }
                      }
                      setTitle(next)
                      titleRef.current = next
                      change()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        editor?.commands.focus('start')
                      }
                    }}
                  />
                </>
              )}
              <div className="row-8" style={{ marginBottom: 8 }}>
                <span className="small" style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--surface-2)' }}>
                  {collection?.name ?? 'No collection'}
                </span>
                <VisibilityBadge mode={visibility} count={shared.length} />
                <span className="small muted">{statusLabel}</span>
              </div>
              <EditorContent editor={editor} />
              {slash ? (
                <div className="slash" role="menu" aria-label="Insert block" style={{ left: slash.x, top: slash.y + 6 }}>
                  {slashItems.map((b, i) => (
                    <button
                      key={b.name}
                      type="button"
                      role="menuitem"
                      className={i === Math.min(slash.sel, slashItems.length - 1) ? 'si on' : 'si'}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        runBlock(b)
                      }}
                    >
                      <span className="sg">{b.glyph}</span>
                      <span className="stack-8" style={{ gap: 0, lineHeight: 1.3 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</span>
                        <span className="small muted">{b.desc}</span>
                      </span>
                      <span className="mono muted" style={{ marginLeft: 'auto', fontSize: 11 }}>
                        {b.md}
                      </span>
                    </button>
                  ))}
                  {!slashItems.length ? <p className="small muted" style={{ margin: '8px 10px' }}>No block called that. Try “table” or “math”.</p> : null}
                </div>
              ) : null}
            </article>
          </div>
        </main>

        {panel ? (
          <SidePanel
            tab={rightTab}
            setTab={setRightTab}
            meta={meta}
            setMeta={setMeta}
            collections={data.collections}
            when={when}
            setWhen={setWhen}
            whenAt={whenAt}
            setWhenAt={setWhenAt}
            visibility={visibility}
            setVisibility={(v) => changeVisibility(v)}
            shared={shared}
            addShare={addShare}
            removeShare={removeShare}
            link={link}
            emailed={data.emailed}
            revisions={revisions}
            restore={restore}
            exportMd={exportMd}
            busy={busy}
          />
        ) : null}
      </div>

      <footer className="ed-foot">
        <span>{(outline?.words ?? 0).toLocaleString('en-US')} words</span>
        <span>about {readingMinutes(outline?.words ?? 0)} min read</span>
        <span>{saveText}</span>
        <span style={{ marginLeft: 'auto' }}>: commands</span>
        <span>/ blocks</span>
        <span>Ctrl+S save</span>
      </footer>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        hidden
        multiple
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          void insertImages(files)
        }}
      />
    </div>
  )
}
