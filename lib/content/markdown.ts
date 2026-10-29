// Two-way bridge between Tiptap JSON and Markdown, via mdast (unified/remark).
// JSON stays the source of truth: Markdown is only for paste, import, export and the Split view.
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import type { Doc, DocNode, Mark } from './types'

type MdNode = {
  type: string
  value?: string
  children?: MdNode[]
  depth?: number
  ordered?: boolean | null
  start?: number | null
  spread?: boolean | null
  checked?: boolean | null
  lang?: string | null
  meta?: string | null
  url?: string
  alt?: string | null
  title?: string | null
  align?: (string | null)[] | null
}

export type FrontMatter = Partial<{
  title: string
  slug: string
  excerpt: string
  collection: string
  visibility: string
  tags: string[]
}>

/* ---------------------------------------------------------------- Markdown -> JSON */

export function splitFrontMatter(md: string): { meta: FrontMatter; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md)
  if (!m) return { meta: {}, body: md }
  const meta: Record<string, unknown> = {}
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line)
    if (!kv) continue
    const [, key, raw] = kv as unknown as [string, string, string]
    let value: unknown = raw.trim().replace(/^"(.*)"$/, '$1')
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }
    meta[key] = value
  }
  return { meta: meta as FrontMatter, body: md.slice(m[0].length) }
}

const CALLOUT_RE = /^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*/i

function inline(nodes: MdNode[] = [], marks: Mark[] = []): DocNode[] {
  const out: DocNode[] = []
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        if (n.value) out.push({ type: 'text', text: n.value, ...(marks.length ? { marks } : {}) })
        break
      case 'strong':
        out.push(...inline(n.children, [...marks, { type: 'bold' }]))
        break
      case 'emphasis':
        out.push(...inline(n.children, [...marks, { type: 'italic' }]))
        break
      case 'delete':
        out.push(...inline(n.children, [...marks, { type: 'strike' }]))
        break
      case 'inlineCode':
        if (n.value) out.push({ type: 'text', text: n.value, marks: [...marks, { type: 'code' }] })
        break
      case 'link':
        out.push(...inline(n.children, [...marks, { type: 'link', attrs: { href: n.url ?? '' } }]))
        break
      case 'break':
        out.push({ type: 'hardBreak' })
        break
      case 'inlineMath':
        out.push({ type: 'inlineMath', attrs: { latex: n.value ?? '' } })
        break
      case 'image':
        if (n.alt) out.push({ type: 'text', text: n.alt, ...(marks.length ? { marks } : {}) })
        break
      case 'html':
        if (n.value) out.push({ type: 'text', text: n.value })
        break
      default:
        out.push(...inline(n.children, marks))
    }
  }
  return out
}

const para = (content: DocNode[]): DocNode => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' })

function block(n: MdNode): DocNode[] {
  switch (n.type) {
    case 'paragraph': {
      const kids = n.children ?? []
      if (kids.length === 1 && kids[0]!.type === 'image') {
        const img = kids[0]!
        return [{ type: 'image', attrs: { src: img.url ?? '', alt: img.alt ?? '', caption: img.title ?? '' } }]
      }
      return [para(inline(kids))]
    }
    case 'heading':
      return [{ type: 'heading', attrs: { level: Math.min(4, Math.max(2, n.depth ?? 2)) }, content: inline(n.children) }]
    case 'blockquote': {
      const first = n.children?.[0]
      const firstText = first?.type === 'paragraph' ? first.children?.[0] : undefined
      const m = firstText?.type === 'text' ? CALLOUT_RE.exec(firstText.value ?? '') : null
      if (m && first && firstText) {
        const tone = m[1]!.toUpperCase() === 'TIP' ? 'tip' : /WARNING|CAUTION/i.test(m[1]!) ? 'warn' : 'note'
        firstText.value = (firstText.value ?? '').slice(m[0].length)
        let title = ''
        const after = first.children ?? []
        const strongIdx = after.findIndex((c) => c.type !== 'text' || (c.value ?? '').trim() !== '')
        if (after[strongIdx]?.type === 'strong') {
          title = inline(after[strongIdx]!.children)
            .map((t) => t.text ?? '')
            .join('')
            .trim()
          after.splice(0, strongIdx + 1)
          if (after[0]?.type === 'text') after[0].value = (after[0].value ?? '').replace(/^\s+/, '')
        }
        const content = (n.children ?? []).flatMap(block).filter((b) => b.type !== 'paragraph' || b.content?.length)
        return [{ type: 'callout', attrs: { tone, title }, content: content.length ? content : [para([])] }]
      }
      return [{ type: 'blockquote', content: (n.children ?? []).flatMap(block) }]
    }
    case 'list': {
      const isTask = (n.children ?? []).some((li) => typeof li.checked === 'boolean')
      const items = (n.children ?? []).map((li) => {
        const content = (li.children ?? []).flatMap(block)
        const safe = content.length && content[0]!.type === 'paragraph' ? content : [para([]), ...content]
        return isTask
          ? { type: 'taskItem', attrs: { checked: !!li.checked }, content: safe }
          : { type: 'listItem', content: safe }
      })
      if (isTask) return [{ type: 'taskList', content: items }]
      return n.ordered
        ? [{ type: 'orderedList', attrs: { start: n.start ?? 1 }, content: items }]
        : [{ type: 'bulletList', content: items }]
    }
    case 'code': {
      const filename = /title="([^"]*)"/.exec(n.meta ?? '')?.[1] ?? ''
      const text = n.value ?? ''
      return [
        {
          type: 'codeBlock',
          attrs: { language: n.lang || 'text', filename },
          content: text ? [{ type: 'text', text }] : [],
        },
      ]
    }
    case 'math':
      return [{ type: 'blockMath', attrs: { latex: n.value ?? '' } }]
    case 'thematicBreak':
      return [{ type: 'horizontalRule' }]
    case 'table':
      return [
        {
          type: 'table',
          content: (n.children ?? []).map((row, r) => ({
            type: 'tableRow',
            content: (row.children ?? []).map((cell) => ({
              type: r === 0 ? 'tableHeader' : 'tableCell',
              content: [para(inline(cell.children))],
            })),
          })),
        },
      ]
    case 'html':
      return n.value ? [para([{ type: 'text', text: n.value }])] : []
    default:
      return n.children ? n.children.flatMap(block) : []
  }
}

export function markdownToDoc(md: string): { doc: Doc; meta: FrontMatter } {
  const { meta, body } = splitFrontMatter(md)
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(body) as unknown as MdNode
  const content = (tree.children ?? []).flatMap(block)
  return { doc: { type: 'doc', content: content.length ? content : [para([])] }, meta }
}

/* ---------------------------------------------------------------- JSON -> Markdown */

function phrasing(nodes: DocNode[] = []): MdNode[] {
  const out: MdNode[] = []
  for (const n of nodes) {
    if (n.type === 'hardBreak') {
      out.push({ type: 'break' })
      continue
    }
    if (n.type === 'inlineMath') {
      out.push({ type: 'inlineMath', value: String(n.attrs?.latex ?? '') })
      continue
    }
    if (n.type !== 'text') continue
    const marks = n.marks ?? []
    let node: MdNode = marks.some((m) => m.type === 'code')
      ? { type: 'inlineCode', value: n.text ?? '' }
      : { type: 'text', value: n.text ?? '' }
    for (const m of marks) {
      if (m.type === 'bold') node = { type: 'strong', children: [node] }
      else if (m.type === 'italic') node = { type: 'emphasis', children: [node] }
      else if (m.type === 'strike') node = { type: 'delete', children: [node] }
    }
    const link = marks.find((m) => m.type === 'link')
    if (link) node = { type: 'link', url: String(link.attrs?.href ?? ''), children: [node] }
    out.push(node)
  }
  return out
}

function toMd(n: DocNode): MdNode[] {
  const a = n.attrs ?? {}
  const kids = (x: DocNode) => (x.content ?? []).flatMap(toMd)
  switch (n.type) {
    case 'paragraph':
      return [{ type: 'paragraph', children: phrasing(n.content) }]
    case 'heading':
      return [{ type: 'heading', depth: Number(a.level) || 2, children: phrasing(n.content) }]
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return [
        {
          type: 'list',
          ordered: n.type === 'orderedList',
          start: n.type === 'orderedList' ? Number(a.start) || 1 : null,
          spread: false,
          children: (n.content ?? []).map((li) => ({
            type: 'listItem',
            spread: false,
            checked: li.type === 'taskItem' ? !!li.attrs?.checked : null,
            children: kids(li),
          })),
        },
      ]
    case 'blockquote':
      return [{ type: 'blockquote', children: kids(n) }]
    case 'callout': {
      const tag = a.tone === 'tip' ? 'TIP' : a.tone === 'warn' ? 'WARNING' : 'NOTE'
      const body = kids(n)
      const head: MdNode[] = [{ type: 'text', value: `[!${tag}] ` }]
      if (a.title) head.push({ type: 'strong', children: [{ type: 'text', value: String(a.title) }] }, { type: 'text', value: ' ' })
      if (body[0]?.type === 'paragraph') body[0].children = [...head, ...(body[0].children ?? [])]
      else body.unshift({ type: 'paragraph', children: head })
      return [{ type: 'blockquote', children: body }]
    }
    case 'codeBlock':
      return [
        {
          type: 'code',
          lang: (a.language as string) || null,
          meta: a.filename ? `title="${String(a.filename)}"` : null,
          value: (n.content ?? []).map((t) => t.text ?? '').join(''),
        },
      ]
    case 'blockMath':
      return [{ type: 'math', value: String(a.latex ?? '') }]
    case 'horizontalRule':
      return [{ type: 'thematicBreak' }]
    case 'image':
      return [
        {
          type: 'paragraph',
          children: [{ type: 'image', url: String(a.src ?? ''), alt: String(a.alt ?? ''), title: (a.caption as string) || null }],
        },
      ]
    case 'youtube':
      return [
        {
          type: 'paragraph',
          children: [{ type: 'link', url: `https://youtu.be/${String(a.videoId ?? '')}`, children: [{ type: 'text', value: 'Watch on YouTube' }] }],
        },
      ]
    case 'table':
      return [
        {
          type: 'table',
          align: null,
          children: (n.content ?? []).map((row) => ({
            type: 'tableRow',
            children: (row.content ?? []).map((cell) => ({
              type: 'tableCell',
              children: (cell.content ?? []).flatMap((p) => phrasing(p.content)),
            })),
          })),
        },
      ]
    default:
      return kids(n)
  }
}

export function docToMarkdown(doc: Doc, meta?: FrontMatter): string {
  const root = { type: 'root', children: (doc.content ?? []).flatMap(toMd) }
  const body = unified()
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkStringify, { bullet: '-', emphasis: '_', fences: true, rule: '-' })
    .stringify(root as never)
  if (!meta) return body
  const lines = Object.entries(meta)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => (Array.isArray(v) ? `${k}: [${v.join(', ')}]` : `${k}: ${k === 'title' ? JSON.stringify(v) : v}`))
  return `---\n${lines.join('\n')}\n---\n\n${body}`
}
