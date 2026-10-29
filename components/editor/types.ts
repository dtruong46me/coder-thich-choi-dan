import type { PostStatus, Visibility } from '@/lib/db/schema'

export type EditorPost = {
  id: string
  kind: 'blog' | 'diary'
  title: string
  slug: string
  excerpt: string
  collectionId: string | null
  status: PostStatus
  visibility: Visibility
  draftJson: { type: 'doc'; content?: unknown[] }
  draftVersion: number
  publishedAt: string | null
  scheduledAt: string | null
  unlistedToken: string | null
  notifyOnPublish: boolean
  updatedAt: string
}

export type Revision = { id: string; version: number; reason: string; createdAt: string }

export type EditorData = {
  post: EditorPost
  tags: string[]
  revisions: Revision[]
  grants: { id: string; email: string }[]
  collections: { id: string; name: string; slug: string }[]
  emailed: boolean
  tree: { id: string; title: string; status: PostStatus; visibility: Visibility; collectionId: string | null }[]
  siteUrl: string
}

export type Meta = {
  slug: string
  excerpt: string
  collectionId: string | null
  tags: string[]
  kind: 'blog' | 'diary'
  notifyOnPublish: boolean
}
