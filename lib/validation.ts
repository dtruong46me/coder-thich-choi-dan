import { z } from 'zod'
import { SLUG_RE } from './slug'

// One schema per input, shared by forms, server actions and API routes.

export const uuid = z.uuid()
export const visibilityEnum = z.enum(['public', 'unlisted', 'members', 'shared', 'private'])
export const kindEnum = z.enum(['blog', 'diary'])
export const email = z.email().max(254).transform((v) => v.trim().toLowerCase())
export const topicsSchema = z.array(z.enum(['Guitar', 'Piano', 'Code', 'Japan', 'Bách Khoa'])).max(5)

const docSchema = z
  .object({ type: z.literal('doc'), content: z.array(z.any()).optional() })
  .passthrough()
  .refine((d) => JSON.stringify(d).length < 2_000_000, 'This post is too large to save.')

export const draftMeta = z.object({
  slug: z.string().regex(SLUG_RE).max(80),
  excerpt: z.string().max(300),
  collectionId: z.uuid().nullable(),
  tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,32}$/)).max(12),
  kind: kindEnum,
  notifyOnPublish: z.boolean(),
})

export const saveDraftInput = z.object({
  postId: uuid,
  baseVersion: z.number().int().min(0),
  title: z.string().max(200),
  draftJson: docSchema,
  meta: draftMeta.partial().optional(),
  reason: z.enum(['autosave', 'manual']).default('autosave'),
})
export type SaveDraftInput = z.input<typeof saveDraftInput>

export const subscribeInput = z.object({
  email,
  topics: topicsSchema.default([]),
  website: z.string().max(0).optional(), // honeypot: real people leave it empty
  turnstileToken: z.string().max(4096).optional(),
})

export const grantInput = z.object({
  email,
  scope: z.enum(['post', 'all_shared_diary', 'members']),
  postId: z.uuid().nullable().optional(),
})

export const uploadInput = z.object({
  filename: z.string().min(1).max(200),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'application/pdf']),
  bytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  bucket: z.enum(['public', 'private']),
})

export const collectionInput = z.object({
  id: z.uuid().optional(),
  slug: z.string().regex(SLUG_RE).max(60),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(300).default(''),
  defaultVisibility: visibilityEnum.default('public'),
})

export const projectInput = z.object({
  id: z.uuid().optional(),
  slug: z.string().regex(SLUG_RE).max(60),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['web', 'music', 'cli', 'course']),
  status: z.enum(['shipped', 'in_progress', 'archived']),
  year: z.string().max(12).default(''),
  description: z.string().max(400).default(''),
  stack: z.array(z.string().max(40)).max(12).default([]),
  links: z.array(z.object({ label: z.string().max(40), href: z.url() })).max(6).default([]),
  featured: z.boolean().default(false),
  postId: z.uuid().nullable().optional(),
})

export const settingsInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  handle: z.string().trim().max(40).optional(),
  tagline: z.string().trim().max(160).optional(),
  defaultTheme: z.enum(['light', 'dark', 'auto']).optional(),
  membersSignup: z.boolean().optional(),
  emailOnPublishDefault: z.boolean().optional(),
  socials: z.record(z.string(), z.string().max(200)).optional(),
})
