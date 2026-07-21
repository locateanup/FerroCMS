/**
 * FerroCMS database schema (PostgreSQL via Drizzle).
 *
 * Content is stored generically: one `entries` row per document, with the
 * typed field values in a JSONB `data` column and hot fields (slug, status,
 * publishedAt) promoted to real columns for indexing and querying. The shape of
 * `data` is enforced at the application layer from the collection definition.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'editor', 'author', 'viewer']);

export const entryStatusEnum = pgEnum('entry_status', [
  'draft',
  'published',
  'scheduled',
  'archived',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: roleEnum('role').notNull().default('author'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // opaque random token (hashed before storage)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
);

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  hashedKey: text('hashed_key').notNull().unique(),
  role: roleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});

export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collection: text('collection').notNull(),
    status: entryStatusEnum('status').notNull().default('draft'),
    slug: text('slug'),
    data: jsonb('data')
      .notNull()
      .default(sql`'{}'::jsonb`),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    collectionStatusIdx: index('entries_collection_status_idx').on(t.collection, t.status),
    collectionSlugIdx: uniqueIndex('entries_collection_slug_idx')
      .on(t.collection, t.slug)
      .where(sql`${t.slug} is not null`),
    publishedAtIdx: index('entries_published_at_idx').on(t.publishedAt),
  }),
);

export const revisions = pgTable(
  'revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    collection: text('collection').notNull(),
    status: entryStatusEnum('status').notNull(),
    data: jsonb('data').notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entryIdx: index('revisions_entry_idx').on(t.entryId),
  }),
);

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(), // R2 object key
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  width: integer('width'),
  height: integer('height'),
  alt: text('alt'),
  uploadedById: uuid('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Revision = typeof revisions.$inferSelect;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
