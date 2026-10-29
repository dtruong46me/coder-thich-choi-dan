'use client'
import { mergeAttributes, Node } from '@tiptap/core'
import CodeBlock from '@tiptap/extension-code-block'
import Highlight from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { Placeholder } from '@tiptap/extensions'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import katex from 'katex'
import { useEffect, useState } from 'react'

const LANGS = ['text', 'python', 'javascript', 'typescript', 'tsx', 'bash', 'json', 'html', 'css', 'sql', 'latex', 'markdown', 'yaml', 'go', 'rust', 'c', 'cpp', 'java', 'tab']

/* ---------------------------------------------------------------- Code block */

function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper as="figure" className="ct-code ed-code">
      <figcaption className="ct-code-bar" contentEditable={false}>
        <input
          className="ed-code-file"
          aria-label="File name"
          placeholder="filename"
          value={(node.attrs.filename as string) ?? ''}
          onChange={(e) => updateAttributes({ filename: e.target.value })}
        />
        <select aria-label="Language" className="ed-code-lang" value={(node.attrs.language as string) || 'text'} onChange={(e) => updateAttributes({ language: e.target.value })}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {l === 'tab' ? 'guitar tab' : l}
            </option>
          ))}
        </select>
      </figcaption>
      <pre className="ct-code-pre">
        <NodeViewContent<'code'> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}

const CodeBlockExt = CodeBlock.extend({
  addAttributes() {
    return {
      language: { default: 'text' },
      filename: { default: '' },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})

/* ---------------------------------------------------------------- Callout */

function CalloutView({ node, updateAttributes }: ReactNodeViewProps) {
  const tone = (node.attrs.tone as string) || 'note'
  return (
    <NodeViewWrapper className={`ct-callout ct-callout-${tone} ed-callout`}>
      <div contentEditable={false} className="ed-callout-bar">
        <select aria-label="Callout style" value={tone} onChange={(e) => updateAttributes({ tone: e.target.value })}>
          <option value="note">Note</option>
          <option value="tip">Tip</option>
          <option value="warn">Warning</option>
        </select>
        <input aria-label="Callout title" placeholder="Title (optional)" value={(node.attrs.title as string) ?? ''} onChange={(e) => updateAttributes({ title: e.target.value })} />
      </div>
      <NodeViewContent className="ct-callout-body" />
    </NodeViewWrapper>
  )
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { tone: { default: 'note' }, title: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
})

/* ---------------------------------------------------------------- Math (preview 300 ms after typing stops) */

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function MathBlockView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const latex = (node.attrs.latex as string) ?? ''
  const shown = useDebounced(latex, 300)
  const [editing, setEditing] = useState(!latex)
  const html = katex.renderToString(shown || '\\square', { displayMode: true, throwOnError: false, trust: false, strict: 'warn' })
  return (
    <NodeViewWrapper className={`ct-math ed-math${selected ? ' is-selected' : ''}`}>
      <div className="ct-math-bar" contentEditable={false}>
        <span>math · LaTeX</span>
        <button type="button" className="ct-math-btn" aria-pressed={editing} onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit LaTeX'}
        </button>
      </div>
      {editing ? (
        <textarea
          className="ct-math-tex ed-math-input"
          aria-label="LaTeX"
          value={latex}
          spellCheck={false}
          onChange={(e) => updateAttributes({ latex: e.target.value })}
          placeholder="d_n = L\left(1 - 2^{-n/12}\right)"
        />
      ) : null}
      <div className="ct-math-out" contentEditable={false} dangerouslySetInnerHTML={{ __html: html }} onDoubleClick={() => setEditing(true)} />
    </NodeViewWrapper>
  )
}

const MathBlockExt = BlockMath.extend({
  addAttributes() {
    return { latex: { default: '' }, caption: { default: '' } }
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})

/* ---------------------------------------------------------------- Image (alt text required before publish) */

function ImageView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const a = node.attrs as { src: string; alt: string; caption: string; width: number | null; height: number | null }
  return (
    <NodeViewWrapper as="figure" className={`ed-image${selected ? ' is-selected' : ''}`} data-drag-handle>
      {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of an uploaded file */}
      <img src={a.src} alt={a.alt} width={a.width ?? undefined} height={a.height ?? undefined} />
      <div className="ed-image-fields" contentEditable={false}>
        <input aria-label="Alt text" className={a.alt ? 'inp' : 'inp missing'} placeholder="Alt text (required): what does the image show?" value={a.alt} onChange={(e) => updateAttributes({ alt: e.target.value })} />
        <input aria-label="Caption" className="inp" placeholder="Caption (optional)" value={a.caption} onChange={(e) => updateAttributes({ caption: e.target.value })} />
      </div>
    </NodeViewWrapper>
  )
}

export const ImageNode = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      mediaId: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      width: { default: null },
      height: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'img[src]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})

/* ---------------------------------------------------------------- YouTube (only the video id is stored) */

export const youtubeId = (input: string) => {
  const m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(input) ?? /^([A-Za-z0-9_-]{11})$/.exec(input.trim())
  return m?.[1] ?? null
}

function YoutubeView({ node, selected }: ReactNodeViewProps) {
  const id = node.attrs.videoId as string
  return (
    <NodeViewWrapper className={`video${selected ? ' is-selected' : ''}`} data-drag-handle>
      <iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title="YouTube video" loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen />
    </NodeViewWrapper>
  )
}

export const Youtube = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { videoId: { default: '' }, title: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-youtube]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-youtube': '' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeView)
  },
})

/* ---------------------------------------------------------------- Everything together */

export function buildExtensions(onInlineMath: (latex: string, pos: number) => void) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => /^(https?:|mailto:|\/|#)/i.test(url),
      },
    }),
    CodeBlockExt,
    Callout,
    MathBlockExt,
    InlineMath.configure({ onClick: (node, pos) => onInlineMath(node.attrs.latex as string, pos), katexOptions: { throwOnError: false, trust: false } }),
    ImageNode,
    Youtube,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight,
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : 'Type / for blocks, or just start writing'),
    }),
  ]
}
