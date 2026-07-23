import { Hono } from 'hono';
import { authenticated, resolveAccess } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import { getCollection } from '../config/collections.js';
import { listCalendarEntries } from '../services/calendar.js';

const router = new Hono<AppBindings>();

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

// Cross-collection view of scheduled/published entries by date. Any
// authenticated user may call it, but — like search — each hit is filtered
// through its own collection's read access rule first.
router.get('/', async (c) => {
  const user = enforce(c, authenticated);

  const fromParam = c.req.query('from');
  const toParam = c.req.query('to');
  const now = new Date();
  const from = fromParam ? new Date(fromParam) : startOfMonth(now);
  const to = toParam ? new Date(toParam) : endOfMonth(now);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw errors.badRequest('Invalid "from"/"to" date.');
  }

  const rows = await listCalendarEntries(c.get('db'), from, to);
  const args = { user: user ? { id: user.id, role: user.role } : null };

  const items = rows
    .filter((entry) => {
      const collection = getCollection(entry.collection);
      return collection ? resolveAccess(collection.access).read({ ...args, id: entry.id }) : false;
    })
    .map((entry) => {
      const collection = getCollection(entry.collection)!;
      const data = entry.data as Record<string, unknown>;
      const titleValue = data[collection.admin.useAsTitle];
      return {
        id: entry.id,
        collection: entry.collection,
        status: entry.status,
        title: typeof titleValue === 'string' ? titleValue : '(untitled)',
        date: (entry.status === 'scheduled' ? entry.scheduledAt : entry.publishedAt)!.toISOString(),
      };
    });

  return c.json({ items });
});

export { router as calendarRouter };
