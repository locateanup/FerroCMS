import { and, desc, eq, sql } from 'drizzle-orm';
import { entries, revisions, type Entry, type Revision } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';
import {
  runAfterChange,
  runBeforeChange,
  slugify,
  type EntryStatus,
  type ResolvedCollection,
} from '@ferrocms/core';
import type { AuthUser } from '../env.js';

type Data = Record<string, unknown>;

/** Derive the slug column value from a collection's slug field, if any. */
function resolveSlug(collection: ResolvedCollection, data: Data): string | null {
  const slugField = collection.fields.find((f) => f.type === 'slug');
  if (!slugField) return null;
  const current = data[slugField.name];
  if (typeof current === 'string' && current.length > 0) {
    const s = slugify(current);
    data[slugField.name] = s;
    return s;
  }
  const from = 'from' in slugField ? slugField.from : undefined;
  const source = from ? data[from] : undefined;
  if (typeof source === 'string' && source.length > 0) {
    const s = slugify(source);
    data[slugField.name] = s;
    return s;
  }
  return null;
}

function accessUser(user: AuthUser | null) {
  return user ? { id: user.id, role: user.role } : null;
}

export interface ListOptions {
  collection: string;
  status?: EntryStatus;
  /** Filter to a single slug (headless "fetch this page" case). */
  slug?: string;
  /** When true, only published entries are returned (public callers). */
  publishedOnly: boolean;
  limit: number;
  offset: number;
}

export async function listEntries(
  db: Db,
  opts: ListOptions,
): Promise<{ items: Entry[]; total: number }> {
  const conditions = [eq(entries.collection, opts.collection)];
  if (opts.publishedOnly) {
    conditions.push(eq(entries.status, 'published'));
  } else if (opts.status) {
    conditions.push(eq(entries.status, opts.status));
  }
  if (opts.slug) {
    conditions.push(eq(entries.slug, opts.slug));
  }
  const where = and(...conditions);

  const items = await db
    .select()
    .from(entries)
    .where(where)
    .orderBy(desc(entries.updatedAt))
    .limit(opts.limit)
    .offset(opts.offset);

  const [count] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(entries)
    .where(where);

  return { items, total: count?.value ?? 0 };
}

export async function getEntry(db: Db, collection: string, id: string): Promise<Entry | null> {
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.collection, collection), eq(entries.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getEntryBySlug(
  db: Db,
  collection: string,
  slug: string,
): Promise<Entry | null> {
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.collection, collection), eq(entries.slug, slug)))
    .limit(1);
  return row ?? null;
}

export interface CreateInput {
  collection: ResolvedCollection;
  data: Data;
  status: EntryStatus;
  user: AuthUser | null;
}

export async function createEntry(db: Db, input: CreateInput): Promise<Entry> {
  const { collection, status, user } = input;
  let data = { ...input.data };

  data = await runBeforeChange(collection.hooks?.beforeChange, {
    operation: 'create',
    data,
    user: accessUser(user),
  });

  const slug = resolveSlug(collection, data);
  const publishedAt = status === 'published' ? new Date() : null;

  const [row] = await db
    .insert(entries)
    .values({
      collection: collection.slug,
      status,
      slug,
      data,
      authorId: user?.id ?? null,
      publishedAt,
    })
    .returning();

  const created = row!;
  await snapshot(db, created);
  await runAfterChange(collection.hooks?.afterChange, {
    operation: 'create',
    doc: created,
    user: accessUser(user),
  });
  return created;
}

export interface UpdateInput {
  collection: ResolvedCollection;
  existing: Entry;
  data?: Data;
  status?: EntryStatus;
  user: AuthUser | null;
}

export async function updateEntry(db: Db, input: UpdateInput): Promise<Entry> {
  const { collection, existing, user } = input;
  const merged: Data = { ...(existing.data as Data), ...(input.data ?? {}) };

  const data = await runBeforeChange(collection.hooks?.beforeChange, {
    operation: 'update',
    data: merged,
    existing: existing.data as Data,
    user: accessUser(user),
  });

  const slug = resolveSlug(collection, data) ?? existing.slug;
  const nextStatus = input.status ?? existing.status;
  const publishedAt =
    nextStatus === 'published' && existing.status !== 'published'
      ? new Date()
      : existing.publishedAt;

  const [row] = await db
    .update(entries)
    .set({ data, slug, status: nextStatus, publishedAt, updatedAt: new Date() })
    .where(eq(entries.id, existing.id))
    .returning();

  const updated = row!;
  await snapshot(db, updated);
  await runAfterChange(collection.hooks?.afterChange, {
    operation: 'update',
    doc: updated,
    previous: existing,
    user: accessUser(user),
  });
  return updated;
}

export async function deleteEntry(db: Db, id: string): Promise<void> {
  await db.delete(entries).where(eq(entries.id, id));
}

/** Write an immutable snapshot into the revisions table. */
async function snapshot(db: Db, entry: Entry): Promise<void> {
  await db.insert(revisions).values({
    entryId: entry.id,
    collection: entry.collection,
    status: entry.status,
    data: entry.data,
    authorId: entry.authorId,
  });
}

export async function listRevisions(db: Db, entryId: string): Promise<Revision[]> {
  return db
    .select()
    .from(revisions)
    .where(eq(revisions.entryId, entryId))
    .orderBy(desc(revisions.createdAt))
    .limit(50);
}

export async function getRevision(db: Db, revisionId: string): Promise<Revision | null> {
  const [row] = await db.select().from(revisions).where(eq(revisions.id, revisionId)).limit(1);
  return row ?? null;
}
