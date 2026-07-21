import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  ENTRY_STATUSES,
  resolveAccess,
  validateEntry,
  type EntryStatus,
  type ResolvedCollection,
} from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { getCollection } from '../config/collections.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import * as svc from '../services/entries.js';

const router = new Hono<AppBindings>();

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

/** Postgres unique-violation guard so slug clashes return 409, not 500. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
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
  return c.json({ ...result, limit, offset });
});

// Get one entry by id.
router.get('/:collection/:id', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const id = c.req.param('id');
  enforce(c, resolveAccess(collection.access).read, id);

  const entry = await svc.getEntry(c.get('db'), collection.slug, id);
  if (!entry) throw errors.notFound('Entry');
  if (c.get('user') === null && entry.status !== 'published') throw errors.notFound('Entry');
  return c.json(entry);
});

// Create an entry.
router.post('/:collection', async (c) => {
  const collection = requireCollection(c.req.param('collection'));
  const user = enforce(c, resolveAccess(collection.access).create);

  const body = await parseBody(c, createBody);
  const validation = validateEntry(collection.fields, body.data);
  if (!validation.success) throw errors.validation(validation.errors);

  try {
    const entry = await svc.createEntry(c.get('db'), {
      collection,
      data: validation.data!,
      status: body.status ?? 'draft',
      user,
    });
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
    const validation = validateEntry(collection.fields, body.data, { partial: true });
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
  return c.body(null, 204);
});

export { router as entriesRouter };
