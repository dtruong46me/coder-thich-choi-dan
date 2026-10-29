import { sql } from 'drizzle-orm'
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'

// citext: emails compare case-insensitively.
const citext = customType<{ data: string }>({ dataType: () => 'citext' })
// tsvector is written by publish, never read back by the app.
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })

const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7())
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

export const userRole = pgEnum('user_role', ['owner', 'reader'])
export const postKind = pgEnum('post_kind', ['blog', 'diary'])
export const postStatus = pgEnum('post_status', ['draft', 'scheduled', 'published', 'archived'])
export const visibility = pgEnum('visibility', ['public', 'unlisted', 'members', 'shared', 'private'])
export const revisionReason = pgEnum('revision_reason', ['autosave', 'manual', 'publish', 'restore'])
export const grantScope = pgEnum('grant_scope', ['post', 'all_shared_diary', 'members'])
export const mediaBucket = pgEnum('media_bucket', ['public', 'private'])
export const projectStatus = pgEnum('project_status', ['shipped', 'in_progress', 'archived'])
export const subscriberStatus = pgEnum('subscriber_status', ['pending', 'confirmed', 'unsubscribed', 'bounced'])
export const campaignStatus = pgEnum('campaign_status', ['queued', 'sending', 'done', 'failed'])

/* ---------------------------------------------------------------- Better Auth */

export const users = pgTable('users', {
  id: id(),
  email: citext('email').notNull().unique(),
  name: text('name').notNull().default(''),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: userRole('role').notNull().default('reader'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    token: text('token').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export const accounts = pgTable(
  'accounts',
  {
    id: id(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
)

export const verifications = pgTable(
  'verifications',
  {
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
)

export const passkeys = pgTable(
  'passkeys',
  {
    id: id(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull(),
    transports: text('transports'),
    aaguid: text('aaguid'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('passkeys_user_idx').on(t.userId), index('passkeys_credential_idx').on(t.credentialID)],
)

/* ---------------------------------------------------------------- Content */

export const collections = pgTable('collections', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  position: integer('position').notNull().default(0),
  defaultVisibility: visibility('default_visibility').notNull().default('public'),
})

export const media = pgTable('media', {
  id: id(),
  storageKey: text('storage_key').notNull().unique(),
  bucket: mediaBucket('bucket').notNull(),
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  blurhash: text('blurhash'),
  alt: text('alt').notNull().default(''),
  createdAt: createdAt(),
})

export type TocEntry = { id: string; text: string; level: number }

export const posts = pgTable(
  'posts',
  {
    id: id(),
    kind: postKind('kind').notNull().default('blog'),
    title: text('title').notNull().default(''),
    slug: text('slug').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    collectionId: uuid('collection_id').references(() => collections.id, { onDelete: 'set null' }),
    status: postStatus('status').notNull().default('draft'),
    visibility: visibility('visibility').notNull().default('private'),
    draftJson: jsonb('draft_json').notNull().default({ type: 'doc', content: [] }),
    draftVersion: integer('draft_version').notNull().default(0),
    publishedHtml: text('published_html'),
    publishedToc: jsonb('published_toc').$type<TocEntry[]>(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    unlistedToken: text('unlisted_token').unique(),
    notifyOnPublish: boolean('notify_on_publish').notNull().default(false),
    wordCount: integer('word_count').notNull().default(0),
    readingMinutes: integer('reading_minutes').notNull().default(0),
    coverMediaId: uuid('cover_media_id').references(() => media.id, { onDelete: 'set null' }),
    searchVector: tsvector('search_vector'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('posts_kind_slug_key').on(t.kind, t.slug),
    index('posts_listing_idx')
      .on(t.kind, t.visibility, t.publishedAt.desc())
      .where(sql`${t.status} = 'published' AND ${t.deletedAt} IS NULL`),
    index('posts_search_idx').using('gin', t.searchVector),
    index('posts_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
    index('posts_collection_idx').on(t.collectionId),
  ],
)

export const postRevisions = pgTable(
  'post_revisions',
  {
    id: id(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    contentJson: jsonb('content_json').notNull(),
    reason: revisionReason('reason').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('post_revisions_post_version_idx').on(t.postId, t.version.desc())],
)

export const tags = pgTable('tags', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
})

export const postTags = pgTable(
  'post_tags',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index('post_tags_tag_post_idx').on(t.tagId, t.postId)],
)

export const accessGrants = pgTable(
  'access_grants',
  {
    id: id(),
    email: citext('email').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    scope: grantScope('scope').notNull(),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('access_grants_active_email_idx').on(t.email).where(sql`${t.revokedAt} IS NULL`),
    index('access_grants_post_idx').on(t.postId),
  ],
)

export type ProjectLink = { label: string; href: string }

export const projects = pgTable('projects', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  kind: text('kind').notNull(), // web | music | cli | course
  status: projectStatus('status').notNull().default('in_progress'),
  year: text('year').notNull().default(''),
  description: text('description').notNull().default(''),
  stack: text('stack')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  links: jsonb('links').$type<ProjectLink[]>().notNull().default([]),
  featured: boolean('featured').notNull().default(false),
  position: integer('position').notNull().default(0),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
})

/* ---------------------------------------------------------------- Email */

export const subscribers = pgTable(
  'subscribers',
  {
    id: id(),
    email: citext('email').notNull().unique(),
    status: subscriberStatus('status').notNull().default('pending'),
    topics: text('topics')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    confirmTokenHash: text('confirm_token_hash'),
    createdAt: createdAt(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  },
  (t) => [index('subscribers_confirmed_idx').on(t.status).where(sql`${t.status} = 'confirmed'`)],
)

export const emailCampaigns = pgTable('email_campaigns', {
  id: id(),
  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  status: campaignStatus('status').notNull().default('queued'),
  createdAt: createdAt(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const emailDeliveries = pgTable(
  'email_deliveries',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: 'cascade' }),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    providerMessageId: text('provider_message_id'),
    status: text('status').notNull().default('sent'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.subscriberId] })],
)

/* ---------------------------------------------------------------- Site */

export const postViewsDaily = pgTable(
  'post_views_daily',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    views: integer('views').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.day] })],
)

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
})

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    meta: jsonb('meta').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_created_idx').on(t.createdAt.desc())],
)

export type Post = typeof posts.$inferSelect
export type Collection = typeof collections.$inferSelect
export type Project = typeof projects.$inferSelect
export type Visibility = (typeof visibility.enumValues)[number]
export type PostKind = (typeof postKind.enumValues)[number]
export type PostStatus = (typeof postStatus.enumValues)[number]
