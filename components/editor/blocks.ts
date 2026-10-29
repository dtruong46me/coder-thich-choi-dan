'use client'
import type { ChainedCommands, Editor } from '@tiptap/react'
import { youtubeId } from './extensions'

export type BlockDef = {
  name: string
  glyph: string
  desc: string
  md: string
  run: (chain: ChainedCommands, editor: Editor, ctx: { pickImage: () => void }) => ChainedCommands | void
}

// The "/" menu and the ribbon's insert buttons share these definitions.
export const BLOCKS: BlockDef[] = [
  { name: 'Text', glyph: 'Aa', desc: 'Plain paragraph', md: '', run: (c) => c.setParagraph() },
  { name: 'Heading', glyph: 'H2', desc: 'Section title, shows in the outline', md: '##', run: (c) => c.setHeading({ level: 2 }) },
  { name: 'Sub-heading', glyph: 'H3', desc: 'Smaller title', md: '###', run: (c) => c.setHeading({ level: 3 }) },
  { name: 'Bulleted list', glyph: '•', desc: 'A simple list', md: '-', run: (c) => c.toggleBulletList() },
  { name: 'Numbered list', glyph: '1.', desc: 'An ordered list', md: '1.', run: (c) => c.toggleOrderedList() },
  { name: 'To-do', glyph: '[ ]', desc: 'Checkboxes', md: '[]', run: (c) => c.toggleTaskList() },
  { name: 'Quote', glyph: '"', desc: 'Pull quote', md: '>', run: (c) => c.toggleBlockquote() },
  {
    name: 'Callout',
    glyph: 'i',
    desc: 'Tinted box for a TL;DR or tip',
    md: '',
    run: (c) => c.insertContent({ type: 'callout', attrs: { tone: 'note', title: '' }, content: [{ type: 'paragraph' }] }),
  },
  { name: 'Code', glyph: '{ }', desc: 'Syntax-highlighted code', md: '```', run: (c) => c.setCodeBlock({ language: 'python' }) },
  { name: 'Math', glyph: '∑', desc: 'Display LaTeX', md: '$$', run: (c) => c.insertContent({ type: 'blockMath', attrs: { latex: '' } }) },
  { name: 'Table', glyph: '▦', desc: 'Rows and columns', md: '|', run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
  {
    name: 'Image',
    glyph: 'img',
    desc: 'Upload, paste or drop',
    md: '',
    run: (_c, _e, ctx) => {
      ctx.pickImage()
    },
  },
  {
    name: 'YouTube',
    glyph: 'yt',
    desc: 'Embed a video',
    md: '',
    run: (c) => {
      const id = youtubeId(window.prompt('YouTube link or video id') ?? '')
      return id ? c.insertContent({ type: 'youtube', attrs: { videoId: id } }) : c
    },
  },
  { name: 'Guitar tab', glyph: 'TAB', desc: 'Monospace tab that stays aligned', md: '', run: (c) => c.setCodeBlock({ language: 'tab' }) },
  { name: 'Divider', glyph: 'hr', desc: 'A thin line', md: '---', run: (c) => c.setHorizontalRule() },
]

export const filterBlocks = (q: string) => {
  const s = q.trim().toLowerCase()
  return BLOCKS.filter((b) => !s || b.name.toLowerCase().includes(s) || b.desc.toLowerCase().includes(s))
}
