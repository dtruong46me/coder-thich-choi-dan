'use client'
import { useEditorState, type Editor } from '@tiptap/react'
import type { ReactNode } from 'react'
import { Segmented } from '@/components/ds/Segmented'
import { BLOCKS } from './blocks'

const d = {
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  mark: 'M4 20h7M14.5 4.5l5 5L11 18l-5 1 1-5z',
  left: 'M4 6h16M4 12h10M4 18h14',
  center: 'M4 6h16M7 12h10M5 18h14',
  right: 'M4 6h16M10 12h10M6 18h14',
  justify: 'M4 6h16M4 12h16M4 18h16',
  bullets: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  todo: 'M4 6l1.5 1.5L8 5M11 6h9M4 12l1.5 1.5L8 11M11 12h9M4 18h4M11 18h9',
  image: 'M3 5h18v14H3zM21 15l-5-5-9 9M8.5 9.5h.01',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
  callout: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v.01M11 12h1v5h1',
  hr: 'M4 12h16',
  video: 'M3 6h18v12H3zM10 9l5 3-5 3z',
  wide: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
}

function Svg({ path }: { path: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

function Btn({ label, on, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={on ? 'rb on' : 'rb'} title={label} aria-label={label} aria-pressed={on === undefined ? undefined : on} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  )
}

const Sep = () => <span className="rsep" aria-hidden="true" />

export function Ribbon({
  editor,
  size,
  setSize,
  wide,
  setWide,
  pickImage,
}: {
  editor: Editor
  size: 's' | 'm' | 'l'
  setSize: (s: 's' | 'm' | 'l') => void
  wide: boolean
  setWide: (w: boolean) => void
  pickImage: () => void
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 2 })
        ? 'h2'
        : e.isActive('heading', { level: 3 })
          ? 'h3'
          : e.isActive('heading', { level: 4 })
            ? 'h4'
            : e.isActive('blockquote')
              ? 'quote'
              : e.isActive('codeBlock')
                ? 'code'
                : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      mark: e.isActive('highlight'),
      align: (['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
      table: e.isActive('table'),
    }),
  })
  const c = () => editor.chain().focus()
  const insert = (name: string) => {
    const b = BLOCKS.find((x) => x.name === name)
    if (!b) return
    const res = b.run(c(), editor, { pickImage })
    res?.run()
  }
  const setLink = () => {
    if (s.link) return c().unsetLink().run()
    const url = window.prompt('Link to (https://, mailto: or /path)')
    if (url) c().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="ribbon">
      <label className="ct-sr" htmlFor="blocktype">
        Block type
      </label>
      <select
        id="blocktype"
        className="rsel"
        value={s.block}
        onChange={(e) => {
          const v = e.target.value
          if (v === 'p') c().setParagraph().run()
          else if (v === 'quote') c().toggleBlockquote().run()
          else if (v === 'code') c().toggleCodeBlock().run()
          else c().setHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 }).run()
        }}
      >
        <option value="p">Paragraph</option>
        <option value="h2">Heading</option>
        <option value="h3">Sub-heading</option>
        <option value="h4">Small heading</option>
        <option value="quote">Quote</option>
        <option value="code">Code</option>
      </select>
      <Sep />
      <Btn label="Undo" onClick={() => c().undo().run()}>
        <Svg path={d.undo} />
      </Btn>
      <Btn label="Redo" onClick={() => c().redo().run()}>
        <Svg path={d.redo} />
      </Btn>
      <Sep />
      <Btn label="Bold" on={s.bold} onClick={() => c().toggleBold().run()}>
        <span aria-hidden="true" style={{ fontWeight: 700 }}>
          B
        </span>
      </Btn>
      <Btn label="Italic" on={s.italic} onClick={() => c().toggleItalic().run()}>
        <span aria-hidden="true" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 600, fontSize: 17 }}>
          I
        </span>
      </Btn>
      <Btn label="Underline" on={s.underline} onClick={() => c().toggleUnderline().run()}>
        <span aria-hidden="true" style={{ textDecoration: 'underline' }}>
          U
        </span>
      </Btn>
      <Btn label="Strikethrough" on={s.strike} onClick={() => c().toggleStrike().run()}>
        <span aria-hidden="true" style={{ textDecoration: 'line-through' }}>
          S
        </span>
      </Btn>
      <Btn label="Inline code" on={s.code} onClick={() => c().toggleCode().run()}>
        <span aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {'</>'}
        </span>
      </Btn>
      <Btn label="Link" on={s.link} onClick={setLink}>
        <Svg path={d.link} />
      </Btn>
      <Btn label="Highlight" on={s.mark} onClick={() => c().toggleHighlight().run()}>
        <Svg path={d.mark} />
      </Btn>
      <Sep />
      {(['left', 'center', 'right', 'justify'] as const).map((a) => (
        <Btn key={a} label={`Align ${a}`} on={s.align === a} onClick={() => c().setTextAlign(a).run()}>
          <Svg path={d[a]} />
        </Btn>
      ))}
      <Sep />
      <Btn label="Bulleted list" onClick={() => insert('Bulleted list')}>
        <Svg path={d.bullets} />
      </Btn>
      <Btn label="Numbered list" onClick={() => insert('Numbered list')}>
        <span aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          1.
        </span>
      </Btn>
      <Btn label="Checklist" onClick={() => insert('To-do')}>
        <Svg path={d.todo} />
      </Btn>
      <Sep />
      <Btn label="Insert image" onClick={pickImage}>
        <Svg path={d.image} />
      </Btn>
      <Btn label="Insert table" onClick={() => insert('Table')}>
        <Svg path={d.table} />
      </Btn>
      <Btn label="Insert equation (LaTeX)" onClick={() => insert('Math')}>
        <span aria-hidden="true" style={{ fontSize: 17 }}>
          ∑
        </span>
      </Btn>
      <Btn label="Insert code block" onClick={() => insert('Code')}>
        <span aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {'{ }'}
        </span>
      </Btn>
      <Btn label="Insert callout" onClick={() => insert('Callout')}>
        <Svg path={d.callout} />
      </Btn>
      <Btn label="Insert divider" onClick={() => insert('Divider')}>
        <Svg path={d.hr} />
      </Btn>
      <Btn label="Embed video" onClick={() => insert('YouTube')}>
        <Svg path={d.video} />
      </Btn>
      <Sep />
      <span className="small muted" style={{ margin: '0 4px 0 2px' }}>
        Text
      </span>
      <Segmented
        label="Text size"
        value={size}
        onChange={setSize}
        options={[
          { value: 's', label: 'S' },
          { value: 'm', label: 'M' },
          { value: 'l', label: 'L' },
        ]}
      />
      <Btn label="Full width" on={wide} onClick={() => setWide(!wide)}>
        <Svg path={d.wide} />
      </Btn>
      {s.table ? (
        <>
          <Sep />
          <button type="button" className="tb" onClick={() => c().addRowAfter().run()}>
            + Row
          </button>
          <button type="button" className="tb" onClick={() => c().addColumnAfter().run()}>
            + Column
          </button>
          <button type="button" className="tb" onClick={() => c().deleteRow().run()}>
            − Row
          </button>
          <button type="button" className="tb" onClick={() => c().deleteTable().run()}>
            Delete table
          </button>
        </>
      ) : null}
    </div>
  )
}
