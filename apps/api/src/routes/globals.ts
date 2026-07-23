import { Hono } from 'hono';
import {
  authenticated,
  filterFieldsForRead,
  filterFieldsForWrite,
  resolveGlobalAccess,
  validateEntry,
  type ResolvedGlobal,
} from '@ferrocms/core';
import type { AppBindings, AuthUser } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import { getGlobal, globals } from '../config/globals.js';
import * as svc from '../services/globals.js';

const router = new Hono<AppBindings>();

// Schemas for the admin UI to render forms from (mirrors GET /api/collections).
router.get('/', async (c) => {
  enforce(c, authenticated);
  return c.json({ items: globals.map((g) => ({ slug: g.slug, label: g.label, fields: g.fields })) });
});

/** Same TTL as public entry reads (see routes/entries.ts) — short-lived, purged on write. */
const PUBLIC_CACHE_TTL_SECONDS = 30;

function requireGlobal(slug: string): ResolvedGlobal {
  const global = getGlobal(slug);
  if (!global) throw errors.notFound('Global');
  return global;
}

function accessArgs(user: AuthUser | null) {
  return { user: user ? { id: user.id, role: user.role } : null };
}

router.get('/:slug', async (c) => {
  const global = requireGlobal(c.req.param('slug'));
  const user = c.get('user');
  enforce(c, resolveGlobalAccess(global.access).read);

  const cacheKey = user === null ? `global:${global.slug}` : null;
  if (cacheKey) {
    const cached = await c.get('cache').get(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        headers: { 'content-type': cached.contentType, 'x-cache': 'HIT' },
      });
    }
  }

  const entry = await svc.getOrCreateGlobal(c.get('db'), global);
  const data = filterFieldsForRead(global.fields, entry.data as Record<string, unknown>, accessArgs(user));
  const body = JSON.stringify({ ...entry, data });

  if (cacheKey) {
    await c.get('cache').put(cacheKey, { body, contentType: 'application/json' }, PUBLIC_CACHE_TTL_SECONDS);
  }
  return new Response(body, {
    headers: { 'content-type': 'application/json', ...(cacheKey ? { 'x-cache': 'MISS' } : {}) },
  });
});

router.patch('/:slug', async (c) => {
  const global = requireGlobal(c.req.param('slug'));
  const user = enforce(c, resolveGlobalAccess(global.access).update);

  const raw = await c.req.json().catch(() => {
    throw errors.badRequest('Request body must be valid JSON.');
  });
  const writable = filterFieldsForWrite(global.fields, raw?.data ?? {}, accessArgs(user));
  const validation = validateEntry(global.fields, writable, { partial: true });
  if (!validation.success) throw errors.validation(validation.errors);

  const entry = await svc.updateGlobal(c.get('db'), global, validation.data!, user);
  await c.get('cache').delete(`global:${global.slug}`);
  return c.json(entry);
});

export { router as globalsRouter };
