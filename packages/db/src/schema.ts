/**
 * FerroCMS database schema (SQLite / libSQL — Turso).
 *
 * Content is stored generically: one `entries` row per document, with the typed
 * field values in a JSON `data` column and hot fields (slug, status,
 * publishedAt) promoted to real columns for indexing and querying. The shape of
 * `data` is enforced at the application layer from the collection definition.
 */

import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const ROLES = ['admin', 'editor', 'author', 'viewer'] as const;
const STATUSES = ['draft', 'published', 'scheduled', 'archived'] as const;
const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

const now = sql`(unixepoch())`;

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: text('role', { enum: ROLES }).notNull().default('author'),
  /** Base32 TOTP secret. Set as soon as setup starts; only trusted for login once totpEnabled. */
  totpSecret: text('totp_secret'),
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
  /** Deactivated users can't log in, but their history (authorId, etc.) is preserved. */
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  hashedKey: text('hashed_key').notNull().unique(),
  role: text('role', { enum: ROLES }).notNull().default('viewer'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
});

export const entries = sqliteTable(
  'entries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    collection: text('collection').notNull(),
    status: text('status', { enum: STATUSES }).notNull().default('draft'),
    slug: text('slug'),
    data: text('data', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    /** When status='scheduled', the sweep (Cron Trigger or /system/publish-scheduled) publishes at this time. */
    scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
    /**
     * Editorial workflow — orthogonal to `status` (draft/published/...): an
     * author can submit a draft for review, and an editor+ approves (which
     * publishes it) or rejects it (with a note, back to the author) without
     * that ever becoming a `status` value itself.
     */
    reviewStatus: text('review_status', { enum: REVIEW_STATUSES }),
    reviewNote: text('review_note'),
    reviewRequestedAt: integer('review_requested_at', { mode: 'timestamp' }),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    reviewedById: text('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({
    collectionStatusIdx: index('entries_collection_status_idx').on(t.collection, t.status),
    collectionSlugIdx: uniqueIndex('entries_collection_slug_idx')
      .on(t.collection, t.slug)
      .where(sql`${t.slug} is not null`),
    publishedAtIdx: index('entries_published_at_idx').on(t.publishedAt),
    scheduledAtIdx: index('entries_scheduled_at_idx').on(t.status, t.scheduledAt),
    reviewStatusIdx: index('entries_review_status_idx').on(t.reviewStatus),
  }),
);

export const revisions = sqliteTable(
  'revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    collection: text('collection').notNull(),
    status: text('status', { enum: STATUSES }).notNull(),
    data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({
    entryIdx: index('revisions_entry_idx').on(t.entryId),
  }),
);

export const media = sqliteTable(
  'media',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text('key').notNull().unique(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt'),
    /** Optional user-defined folder path, e.g. "products/2026". */
    folder: text('folder'),
    uploadedById: text('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({
    folderIdx: index('media_folder_idx').on(t.folder),
  }),
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    collection: text('collection'),
    entryId: text('entry_id'),
    details: text('details', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({
    createdAtIdx: index('audit_log_created_at_idx').on(t.createdAt),
    collectionIdx: index('audit_log_collection_idx').on(t.collection, t.entryId),
  }),
);

export const redirects = sqliteTable(
  'redirects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fromPath: text('from_path').notNull().unique(),
    toPath: text('to_path').notNull(),
    statusCode: integer('status_code').notNull().default(301),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
  },
);

export const comments = sqliteTable(
  'comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    collection: text('collection').notNull(),
    entryId: text('entry_id').notNull(),
    authorName: text('author_name').notNull(),
    authorEmail: text('author_email'),
    body: text('body').notNull(),
    approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({
    entryIdx: index('comments_entry_idx').on(t.collection, t.entryId, t.approved),
  }),
);

/** Generic key/value store with optional expiry (sessions, cache). */
export const kv = sqliteTable(
  'kv',
  {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
  },
  (t) => ({
    expiresIdx: index('kv_expires_idx').on(t.expiresAt),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Revision = typeof revisions.$inferSelect;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Kv = typeof kv.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
