import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { atLeast } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import * as svc from '../services/redirects.js';

const router = new Hono<AppBindings>();

const manage = atLeast('editor');

/** Same TTL as other public reads (see routes/entries.ts) — short-lived, purged on write. */
const PUBLIC_CACHE_TTL_SECONDS = 30;

/** libSQL/SQLite unique-violation guard so a duplicate fromPath returns 409, not 500. */
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; message?: string };
  return (
    (e.code?.includes('CONSTRAINT') ?? false) ||
    (e.message?.includes('UNIQUE constraint failed') ?? false)
  );
}

const pathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((p) => p.startsWith('/'), { message: 'Must start with "/".' });
const statusCodeSchema = z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]);

const createSchema = z.object({
  fromPath: pathSchema,
  toPath: pathSchema,
  statusCode: statusCodeSchema.default(301),
});
const updateSchema = z.object({
  fromPath: pathSchema.optional(),
  toPath: pathSchema.optional(),
  statusCode: statusCodeSchema.optional(),
});

async function parseBody<T>(c: Context<AppBindings>, schema: z.ZodType<T>): Promise<T> {
  const raw = await c.req.json().catch(() => {
    throw errors.badRequest('Request body must be valid JSON.');
  });
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw errors.validation(
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

// Public lookup for front-end middleware/edge functions: "does this path
// redirect?" No auth — it only reveals path -> path mappings, the same thing
// a 301 response itself would reveal. Mounted before /:id so it isn't
// shadowed by a param route (this router has no GET /:id, but keep it first
// for clarity).
router.get('/resolve', async (c) => {
  const path = c.req.query('path');
  if (!path) throw errors.badRequest('Missing "path" query parameter.');

  const cacheKey = `redirect:${path}`;
  const cached = await c.get('cache').get(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      headers: { 'content-type': cached.contentType, 'x-cache': 'HIT' },
    });
  }

  const redirect = await svc.findRedirectByFromPath(c.get('db'), path);
  if (!redirect) throw errors.notFound('Redirect');

  const body = JSON.stringify({ toPath: redirect.toPath, statusCode: redirect.statusCode });
  await c.get('cache').put(cacheKey, { body, contentType: 'application/json' }, PUBLIC_CACHE_TTL_SECONDS);
  return new Response(body, { headers: { 'content-type': 'application/json', 'x-cache': 'MISS' } });
});

router.get('/', async (c) => {
  enforce(c, manage);
  const items = await svc.listRedirects(c.get('db'));
  return c.json({ items });
});

router.post('/', async (c) => {
  enforce(c, manage);
  const body = await parseBody(c, createSchema);
  try {
    const redirect = await svc.createRedirect(c.get('db'), body);
    await c.get('cache').delete(`redirect:${body.fromPath}`);
    return c.json(redirect, 201);
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.conflict('A redirect from that path already exists.');
    throw err;
  }
});

router.patch('/:id', async (c) => {
  enforce(c, manage);
  const id = c.req.param('id');
  const existing = await svc.getRedirect(c.get('db'), id);
  if (!existing) throw errors.notFound('Redirect');

  const body = await parseBody(c, updateSchema);
  try {
    const updated = await svc.updateRedirect(c.get('db'), id, body);
    await c.get('cache').delete(`redirect:${existing.fromPath}`);
    if (body.fromPath && body.fromPath !== existing.fromPath) {
      await c.get('cache').delete(`redirect:${body.fromPath}`);
    }
    return c.json(updated);
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.conflict('A redirect from that path already exists.');
    throw err;
  }
});

router.delete('/:id', async (c) => {
  enforce(c, manage);
  const id = c.req.param('id');
  const existing = await svc.getRedirect(c.get('db'), id);
  if (!existing) throw errors.notFound('Redirect');

  await svc.deleteRedirect(c.get('db'), id);
  await c.get('cache').delete(`redirect:${existing.fromPath}`);
  return c.body(null, 204);
});

export { router as redirectsRouter };
