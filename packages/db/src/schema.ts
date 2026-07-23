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

const now = sql`(unixepoch())`;

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: text('role', { enum: ROLES }).notNull().default('author'),
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
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({
    collectionStatusIdx: index('entries_collection_status_idx').on(t.collection, t.status),
    collectionSlugIdx: uniqueIndex('entries_collection_slug_idx')
      .on(t.collection, t.slug)
      .where(sql`${t.slug} is not null`),
    publishedAtIdx: index('entries_published_at_idx').on(t.publishedAt),
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
