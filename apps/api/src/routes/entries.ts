import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  ENTRY_STATUSES,
  filterFieldsForRead,
  filterFieldsForWrite,
  resolveAccess,
  validateEntry,
  type AccessArgs,
  type EntryStatus,
  type ResolvedCollection,
} from '@ferrocms/core';
import type { AppBindings, AuthUser } from '../env.js';
import { getCollection } from '../config/collections.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import { background } from '../lib/background.js';
import { sendWebhooks, type WebhookEventType } from '../lib/webhooks.js';
import type { Entry } from '@ferrocms/db';
import * as svc from '../services/entries.js';

const router = new Hono<AppBindings>();

/** Fire a content webhook in the background (no-op if none configured). */
function emitWebhook(c: Context<AppBindings>, entry: Entry, event: WebhookEventType): void {
  const config = c.get('config');
  if (config.webhookUrls.length === 0) return;
  background(
    c,
    sendWebhooks({
      urls: config.webhookUrls,
      secret: config.webhookSecret,
      event: {
        event,
        collection: entry.collection,
        id: entry.id,
        slug: entry.slug,
        status: entry.status,
        timestamp: new Date().toISOString(),
      },
    }),
  );
}

const statusSchema = z.enum(ENTRY_STATUSES);
const createBody = z.object({
  data: z.record(z.unknown()).default({}),
  status: statusSchema.optional(),
});
const updateBody = z.object({
  data: z.record(z.unknown()).optional(),
  status: statusSchema.optional(),
});

function requireCollection(slug: string): ResolvedCollection {
  const collection = getCollection(slug);
  if (!collection) throw errors.notFound('Collection');
  return collection;
}

function accessArgs(user: AuthUser | null, id?: string): AccessArgs {
  return { user: user ? { id: user.id, role: user.role } : null, id };
}

/** libSQL/SQLite unique-violation guard so slug clashes return 409, not 500. */
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; message?: string };
  return (
    (e.code?.includes('CONSTRAINT') ?? false) ||
    (e.message?.includes('UNIQUE constraint failed') ?? false)
  );
}

async function parseBody<T>(c: Context<AppBindings>, schema: z.ZodType<T>): Promise<T> {
  const raw = await c.req.json().catch(() => {
    throw errors.badRequest('Request body must be valid JSON.');
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw errors.validation(
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return parsed.data;
}

// List entries in a collection.
router.get('/:collection', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const access = resolveAccess(collection.access);
  enforce(c, access.read);

  const user = c.get('user');
  const statusParam = c.req.query('status');
  if (statusParam && !statusSchema.safeParse(statusParam).success) {
    throw errors.badRequest(`Invalid status "${statusParam}".`);
  }
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 20) || 20, 1), 100);
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0);

  const slug = c.req.query('slug');
  const result = await svc.listEntries(c.get('db'), {
    collection: collection.slug,
    status: statusParam as EntryStatus | undefined,
    slug: slug || undefined,
    publishedOnly: user === null,
    limit,
    offset,
  });
  const args = accessArgs(user);
  const items = result.items.map((entry) => ({
    ...entry,
    data: filterFieldsForRead(collection.fields, entry.data as Record<string, unknown>, args),
  }));
  return c.json({ ...result, items, limit, offset });
});

// Get one entry by id.
router.get('/:collection/:id', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const id = c.req.param('id');
  enforce(c, resolveAccess(collection.access).read, id);

  const entry = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!entry) throw errors.notFound('Entry');
  const user = c.get('user');
  if (user === null && entry.status !== 'published') throw errors.notFound('Entry');
  const data = filterFieldsForRead(
    collection.fields,
    entry.data as Record<string, unknown>,
    accessArgs(user, id),
  );
  return c.json({ ...entry, data });
});

// Create an entry.
router.post('/:collection', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const user = enforce(c, resolveAccess(collection.access).create);

  const body = await parseBody(c, createBody);
  const writable = filterFieldsForWrite(collection.fields, body.data ?? {}, accessArgs(user));
  const validation = validateEntry(collection.fields, writable, { locales: collection.locales });
  if (!validation.success) throw errors.validation(validation.errors);

  try {
    const entry = await svc.createEntry(c.get('db'), {
      collection,
      data: validation.data!,
      status: body.status ?? 'draft',
      user,
    });
    emitWebhook(c, entry, entry.status === 'published' ? 'entry.published' : 'entry.created');
    return c.json(entry, 201);
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.conflict('An entry with that slug already exists.');
    throw err;
  }
});

// Update an entry.
router.patch('/:collection/:id', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const id = c.req.param('id');
  const user = enforce(c, resolveAccess(collection.access).update, id);

  const existing = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!existing) throw errors.notFound('Entry');

  const body = await parseBody(c, updateBody);
  if (body.data) {
    const writable = filterFieldsForWrite(collection.fields, body.data, accessArgs(user, id));
    const validation = validateEntry(collection.fields, writable, {
      partial: true,
      locales: collection.locales,
    });
    if (!validation.success) throw errors.validation(validation.errors);
    body.data = validation.data;
  }

  try {
    const entry = await svc.updateEntry(c.get('db'), {
      collection,
      existing,
      data: body.data,
      status: body.status,
      user,
    });
    const justPublished = existing.status !== 'published' && entry.status === 'published';
    emitWebhook(c, entry, justPublished ? 'entry.published' : 'entry.updated');
    return c.json(entry);
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.conflict('An entry with that slug already exists.');
    throw err;
  }
});

// Delete an entry.
router.delete('/:collection/:id', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const id = c.req.param('id');
  enforce(c, resolveAccess(collection.access).delete, id);

  const existing = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!existing) throw errors.notFound('Entry');

  await svc.deleteEntry(c.get('db'), id);
  emitWebhook(c, existing, 'entry.deleted');
  return c.body(null, 204);
});

// List an entry's revision history (newest first).
router.get('/:collection/:id/revisions', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const id = c.req.param('id');
  enforce(c, resolveAccess(collection.access).update, id);

  const existing = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!existing) throw errors.notFound('Entry');

  const items = await svc.listRevisions(c.get('db'), id);
  return c.json({ items });
});

// Restore an entry's data from a past revision.
router.post('/:collection/:id/revisions/:revisionId/restore', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const id = c.req.param('id');
  const user = enforce(c, resolveAccess(collection.access).update, id);

  const existing = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!existing) throw errors.notFound('Entry');

  const revision = await svc.getRevision(c.get('db'), c.req.param('revisionId'));
  if (!revision || revision.entryId !== id) throw errors.notFound('Revision');

  try {
    const entry = await svc.updateEntry(c.get('db'), {
      collection,
      existing,
      data: revision.data as Record<string, unknown>,
      user,
    });
    emitWebhook(c, entry, 'entry.updated');
    return c.json(entry);
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.conflict('An entry with that slug already exists.');
    throw err;
  }
});

export { router as entriesRouter };
