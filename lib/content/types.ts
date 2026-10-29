// Tiptap/ProseMirror JSON as stored in posts.draft_json. This is the only source of truth for content.
export type MarkType = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'highlight' | 'link'
export type Mark = { type: MarkType | (string & {}); attrs?: Record<string, unknown> }

export type DocNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  text?: string
  marks?: Mark[]
}

export type Doc = DocNode & { type: 'doc' }

export const emptyDoc = (): Doc => ({ type: 'doc', content: [{ type: 'paragraph' }] })

export const CALLOUT_TONES = ['note', 'tip', 'warn'] as const
export type CalloutTone = (typeof CALLOUT_TONES)[number]
