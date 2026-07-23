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
import { createPreviewToken, verifyPreviewToken } from '../lib/previewToken.js';
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
const scheduledAtSchema = z.coerce.date().nullable().optional();
const createBody = z.object({
  data: z.record(z.unknown()).default({}),
  status: statusSchema.optional(),
  scheduledAt: scheduledAtSchema,
});
const updateBody = z.object({
  data: z.record(z.unknown()).optional(),
  status: statusSchema.optional(),
  scheduledAt: scheduledAtSchema,
});

/**
 * A `'scheduled'` entry always needs a future `scheduledAt` — resolve it from
 * the request (falling back to what's already stored, on update) and enforce
 * that. Any other status clears it (the publish sweep only looks at
 * `'scheduled'` rows, so a stale date left on a published/draft entry would be
 * meaningless — and confusing if the entry is rescheduled without a new date).
 */
function resolveScheduledAt(
  status: EntryStatus | undefined,
  provided: Date | null | undefined,
  existing: Date | null | undefined,
): Date | null {
  if (status !== 'scheduled') return null;
  const value = provided !== undefined ? provided : (existing ?? null);
  if (!value) throw errors.badRequest('A scheduled entry requires "scheduledAt".');
  if (value.getTime() <= Date.now()) {
    throw errors.badRequest('"scheduledAt" must be in the future.');
  }
  return value;
}

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

/**
 * How long a public (anonymous, published-only) read may be served stale from
 * cache before hitting the database again. This is TTL-based staleness, not
 * push-invalidated on publish — a request can lag up to this long behind the
 * latest write. Keep it short rather than promising instant invalidation.
 */
const PUBLIC_CACHE_TTL_SECONDS = 30;

/** Return a cached JSON response with an `x-cache` observability header. */
function cachedJson(cached: { body: string; contentType: string }): Response {
  return new Response(cached.body, {
    headers: { 'content-type': cached.contentType, 'x-cache': 'HIT' },
  });
}

/** Serve fresh JSON, caching it in the background for public reads only. */
function freshJson(c: Context<AppBindings>, payload: unknown, cacheKey: string | null): Response {
  const body = JSON.stringify(payload);
  if (cacheKey) {
    background(
      c,
      c
        .get('cache')
        .put(cacheKey, { body, contentType: 'application/json' }, PUBLIC_CACHE_TTL_SECONDS),
    );
  }
  return new Response(body, {
    headers: { 'content-type': 'application/json', ...(cacheKey ? { 'x-cache': 'MISS' } : {}) },
  });
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
  const publishedOnly = user === null;

  // Only anonymous, published-only reads are safe to cache — authenticated
  // responses vary by role (field-level permissions) and may include drafts.
  const cacheKey = publishedOnly
    ? `list:${collection.slug}:${slug ?? ''}:${limit}:${offset}`
    : null;
  if (cacheKey) {
    const cached = await c.get('cache').get(cacheKey);
    if (cached) return cachedJson(cached);
  }

  const result = await svc.listEntries(c.get('db'), {
    collection: collection.slug,
    status: statusParam as EntryStatus | undefined,
    slug: slug || undefined,
    publishedOnly,
    limit,
    offset,
  });
  const args = accessArgs(user);
  const items = result.items.map((entry) => ({
    ...entry,
    data: filterFieldsForRead(collection.fields, entry.data as Record<string, unknown>, args),
  }));
  return freshJson(c, { ...result, items, limit, offset }, cacheKey);
});

// Get one entry by id.
router.get('/:collection/:id', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const id = c.req.param('id');
  enforce(c, resolveAccess(collection.access).read, id);

  const user = c.get('user');
  const cacheKey = user === null ? `one:${collection.slug}:${id}` : null;
  if (cacheKey) {
    const cached = await c.get('cache').get(cacheKey);
    if (cached) return cachedJson(cached);
  }

  const entry = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!entry) throw errors.notFound('Entry');
  if (user === null && entry.status !== 'published') throw errors.notFound('Entry');
  const data = filterFieldsForRead(
    collection.fields,
    entry.data as Record<string, unknown>,
    accessArgs(user, id),
  );
  return freshJson(c, { ...entry, data }, cacheKey);
});

// Create an entry.
router.post('/:collection', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const user = enforce(c, resolveAccess(collection.access).create);

  const body = await parseBody(c, createBody);
  const writable = filterFieldsForWrite(collection.fields, body.data ?? {}, accessArgs(user));
  const validation = validateEntry(collection.fields, writable, { locales: collection.locales });
  if (!validation.success) throw errors.validation(validation.errors);

  const status = body.status ?? 'draft';
  const scheduledAt = resolveScheduledAt(status, body.scheduledAt, undefined);

  try {
    const entry = await svc.createEntry(c.get('db'), {
      collection,
      data: validation.data!,
      status,
      scheduledAt,
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

  const scheduledAt = resolveScheduledAt(
    body.status ?? existing.status,
    body.scheduledAt,
    existing.scheduledAt,
  );

  try {
    const entry = await svc.updateEntry(c.get('db'), {
      collection,
      existing,
      data: body.data,
      status: body.status,
      scheduledAt,
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
  const user = enforce(c, resolveAccess(collection.access).delete, id);

  const existing = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!existing) throw errors.notFound('Entry');

  await svc.deleteEntry(c.get('db'), existing, user);
  emitWebhook(c, existing, 'entry.deleted');
  return c.body(null, 204);
});

// Mint a short-lived preview token for one entry. Only someone who already
// has read access to the entry (an editor working on a draft, typically) can
// request one — the resulting token itself is unauthenticated and public.
router.post('/:collection/:id/preview-token', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const id = c.req.param('id');
  enforce(c, resolveAccess(collection.access).read, id);

  const existing = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!existing) throw errors.notFound('Entry');

  const { token, expiresAt } = await createPreviewToken(
    c.get('config').authSecret,
    collection.slug,
    id,
  );
  return c.json({ token, expiresAt });
});

// Fetch a draft/unpublished entry given a valid preview token — the backend
// half of "live preview" (your front-end's preview route calls this). Bypasses
// the published-only gate only; field-level read permissions still apply as
// if the request were anonymous.
router.get('/:collection/:id/preview', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const id = c.req.param('id');
  const token = c.req.query('token');
  if (!token) throw errors.badRequest('Missing preview token.');

  const valid = await verifyPreviewToken(c.get('config').authSecret, collection.slug, id, token);
  if (!valid) throw errors.unauthorized('Invalid or expired preview token.');

  const entry = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!entry) throw errors.notFound('Entry');
  const data = filterFieldsForRead(
    collection.fields,
    entry.data as Record<string, unknown>,
    accessArgs(null, id),
  );
  return c.json({ ...entry, data });
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
