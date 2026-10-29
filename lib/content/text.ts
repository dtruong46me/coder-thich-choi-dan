import type { DocNode } from './types'

const BLOCKS = new Set([
  'paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'taskItem', 'tableCell', 'tableHeader',
  'blockMath', 'callout', 'image', 'horizontalRule',
])

/** Plain text of a document, one block per line. Used for word count, excerpts and search. */
export function docToText(node: DocNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'inlineMath' || node.type === 'blockMath') return String(node.attrs?.latex ?? '')
  if (node.type === 'image') return String(node.attrs?.alt ?? '')
  const inner = (node.content ?? []).map(docToText).join('')
  return BLOCKS.has(node.type) ? `${inner}\n` : inner
}

export function countWords(text: string): number {
  const m = text.trim().match(/[\p{L}\p{N}'’-]+/gu)
  return m ? m.length : 0
}

/** About 220 words a minute, never less than one minute. */
export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 220))

export function excerptFrom(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length)}…`
}
