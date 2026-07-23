import { Hono } from 'hono';
import { authenticated, resolveAccess } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import { getCollection } from '../config/collections.js';
import { searchEntries } from '../services/search.js';

const router = new Hono<AppBindings>();

// Cross-collection full-text search (admin search box). Any authenticated
// user may search — matching the existing REST list endpoint's behavior,
// where any logged-in user can already list any status (see entries.ts) —
// but each hit is still filtered through that collection's own read access
// rule, so e.g. an editor-only collection doesn't leak through search.
router.get('/', async (c) => {
  const user = enforce(c, authenticated);
  const q = c.req.query('q') ?? '';
  if (!q.trim()) throw errors.badRequest('Missing search query "q".');
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 20) || 20, 1), 50);

  // Over-fetch since some hits may be filtered out by access below.
  const hits = await searchEntries(c.get('db'), q, limit * 3);
  const visible = hits.filter((hit) => {
    const collection = getCollection(hit.collection);
    if (!collection) return false;
    const args = { user: user ? { id: user.id, role: user.role } : null, id: hit.entryId };
    return resolveAccess(collection.access).read(args);
  });

  return c.json({ items: visible.slice(0, limit) });
});

export { router as searchRouter };
