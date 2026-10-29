import 'server-only'
import type { TocEntry } from '../db/schema'
import { slugify } from '../slug'
import { highlight } from './highlight'
import { renderMath } from './math'
import { countWords, docToText, readingMinutes } from './text'
import { CALLOUT_TONES, type Doc, type DocNode, type Mark } from './types'

export type RenderResult = {
  html: string
  toc: TocEntry[]
  text: string
  wordCount: number
  readingMinutes: number
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]!)

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:']
export function safeHref(href: unknown): string | null {
  if (typeof href !== 'string' || !href.trim()) return null
  const h = href.trim()
  if (h.startsWith('/') && !h.startsWith('//')) return h
  if (h.startsWith('#')) return h
  try {
    return SAFE_PROTOCOLS.includes(new URL(h).protocol) ? h : null
  } catch {
    return null
  }
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Images may only come from our own R2 host or the signed private-media route. */
export function safeImageSrc(attrs: Record<string, unknown> | undefined): string | null {
  const mediaId = attrs?.mediaId
  const src = attrs?.src
  if (typeof src !== 'string') return null
  if (typeof mediaId === 'string' && UUID.test(mediaId) && src === `/api/media/${mediaId}`) return src
  const host = process.env.R2_PUBLIC_HOST
  if (host && src.startsWith(`https://${host}/`)) return src
  return null
}

const ALIGN = new Set(['left', 'center', 'right', 'justify'])
const alignStyle = (attrs?: Record<string, unknown>) => {
  const a = attrs?.textAlign
  return typeof a === 'string' && ALIGN.has(a) && a !== 'left' ? ` style="text-align:${a}"` : ''
}

const ICON_INFO =
  '<svg class="ct-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v5h1"/></svg>'
const ICON_CHECK =
  '<svg class="ct-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'

function renderText(node: DocNode): string {
  let out = esc(node.text)
  const marks: Mark[] = node.marks ?? []
  // Apply code first so it sits innermost; links last so they wrap everything.
  const order = ['code', 'bold', 'italic', 'underline', 'strike', 'highlight', 'link']
  for (const type of order) {
    const m = marks.find((x) => x.type === type)
    if (!m) continue
    switch (type) {
      case 'code':
        out = `<code class="ic">${out}</code>`
        break
      case 'bold':
        out = `<strong>${out}</strong>`
        break
      case 'italic':
        out = `<em>${out}</em>`
        break
      case 'underline':
        out = `<u>${out}</u>`
        break
      case 'strike':
        out = `<s>${out}</s>`
        break
      case 'highlight':
        out = `<mark>${out}</mark>`
        break
      case 'link': {
        const href = safeHref(m.attrs?.href)
        if (href) {
          const external = /^https?:/.test(href)
          out = `<a href="${esc(href)}"${external ? ' rel="noopener noreferrer nofollow"' : ''}>${out}</a>`
        }
        break
      }
    }
  }
  return out
}

type Ctx = { toc: TocEntry[]; ids: Map<string, number> }

function headingId(ctx: Ctx, text: string) {
  const base = slugify(text) || 'section'
  const n = (ctx.ids.get(base) ?? 0) + 1
  ctx.ids.set(base, n)
  return n === 1 ? base : `${base}-${n}`
}

async function children(node: DocNode, ctx: Ctx): Promise<string> {
  const parts = await Promise.all((node.content ?? []).map((c) => renderNode(c, ctx)))
  return parts.join('')
}

async function renderNode(node: DocNode, ctx: Ctx): Promise<string> {
  const a = node.attrs ?? {}
  switch (node.type) {
    case 'doc':
      return children(node, ctx)
    case 'text':
      return renderText(node)
    case 'hardBreak':
      return '<br>'
    case 'paragraph':
      return `<p${alignStyle(a)}>${await children(node, ctx)}</p>`
    case 'heading': {
      const level = Math.min(4, Math.max(2, Number(a.level) || 2)) // h1 is the post title
      const text = docToText(node).trim()
      const id = headingId(ctx, text)
      if (level <= 3) ctx.toc.push({ id, text, level })
      return `<h${level} id="${esc(id)}"${alignStyle(a)}>${await children(node, ctx)}</h${level}>`
    }
    case 'bulletList':
      return `<ul>${await children(node, ctx)}</ul>`
    case 'orderedList': {
      const start = Number(a.start)
      return `<ol${Number.isInteger(start) && start > 1 ? ` start="${start}"` : ''}>${await children(node, ctx)}</ol>`
    }
    case 'listItem':
      return `<li>${await children(node, ctx)}</li>`
    case 'taskList':
      return `<ul class="tasks">${await children(node, ctx)}</ul>`
    case 'taskItem':
      return `<li class="task"><input type="checkbox" disabled${a.checked ? ' checked' : ''} aria-label="${a.checked ? 'Done' : 'Not done'}"><div>${await children(node, ctx)}</div></li>`
    case 'blockquote':
      return `<blockquote>${await children(node, ctx)}</blockquote>`
    case 'horizontalRule':
      return '<hr>'
    case 'codeBlock': {
      const code = docToText(node).replace(/\n$/, '')
      const lang = typeof a.language === 'string' && a.language ? a.language : 'text'
      const filename = typeof a.filename === 'string' ? a.filename : ''
      const label = `${filename ? `${esc(filename)} · ` : ''}${esc(lang === 'tab' ? 'guitar tab' : lang)}`
      return `<figure class="ct-code"><figcaption class="ct-code-bar"><span>${label}</span><button type="button" class="ct-code-copy" data-copy>Copy</button></figcaption>${await highlight(code, lang)}</figure>`
    }
    case 'blockMath': {
      const tex = String(a.latex ?? '')
      return `<figure class="ct-math"><div class="ct-math-out">${renderMath(tex, true)}</div>${a.caption ? `<figcaption class="ct-math-cap">${esc(a.caption)}</figcaption>` : ''}</figure>`
    }
    case 'inlineMath':
      return renderMath(String(a.latex ?? ''), false)
    case 'callout': {
      const tone = CALLOUT_TONES.includes(a.tone as never) ? (a.tone as string) : 'note'
      const title = typeof a.title === 'string' && a.title ? `<strong>${esc(a.title)} </strong>` : ''
      return `<div class="ct-callout ct-callout-${tone}"${tone === 'warn' ? ' role="note"' : ''}>${tone === 'tip' ? ICON_CHECK : ICON_INFO}<div class="ct-callout-body">${title}${await children(node, ctx)}</div></div>`
    }
    case 'table':
      return `<div class="table-wrap"><table>${await children(node, ctx)}</table></div>`
    case 'tableRow':
      return `<tr>${await children(node, ctx)}</tr>`
    case 'tableHeader':
    case 'tableCell': {
      const tag = node.type === 'tableHeader' ? 'th' : 'td'
      const span = (k: string) => {
        const v = Number(a[k])
        return Number.isInteger(v) && v > 1 && v < 50 ? ` ${k}="${v}"` : ''
      }
      const scope = tag === 'th' ? ' scope="col"' : ''
      return `<${tag}${scope}${span('colspan')}${span('rowspan')}>${await children(node, ctx)}</${tag}>`
    }
    case 'image': {
      const src = safeImageSrc(a)
      if (!src) return ''
      const w = Number(a.width)
      const h = Number(a.height)
      const dims = w > 0 && h > 0 ? ` width="${w}" height="${h}"` : ''
      const caption = typeof a.caption === 'string' && a.caption ? `<figcaption>${esc(a.caption)}</figcaption>` : ''
      return `<figure class="img"><img src="${esc(src)}" alt="${esc(a.alt)}"${dims} loading="lazy" decoding="async">${caption}</figure>`
    }
    case 'youtube': {
      const id = typeof a.videoId === 'string' && YT_ID.test(a.videoId) ? a.videoId : null
      if (!id) return ''
      return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(a.title || 'YouTube video')}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    }
    default:
      // Unknown node types are never rendered as-is; only their known children survive.
      return children(node, ctx)
  }
}

/** Tiptap JSON -> reader HTML. Runs once, at publish; readers never load KaTeX, Shiki or Tiptap. */
export async function renderDoc(doc: Doc): Promise<RenderResult> {
  const ctx: Ctx = { toc: [], ids: new Map() }
  const html = await renderNode(doc, ctx)
  const text = docToText(doc)
  const wordCount = countWords(text)
  return { html, toc: ctx.toc, text, wordCount, readingMinutes: readingMinutes(wordCount) }
}
