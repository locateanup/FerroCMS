import { Hono } from 'hono';
import { authenticated, resolveAccess } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { getCollection } from '../config/collections.js';
import { countPendingComments, countPendingReviews, getEntryStats } from '../services/dashboard.js';

const router = new Hono<AppBindings>();

router.get('/', async (c) => {
  const user = enforce(c, authenticated);
  const db = c.get('db');

  const stats = await getEntryStats(db);
  const perCollection: Record<string, Record<string, number>> = {};
  for (const row of stats) {
    // Don't leak counts for a collection this user can't even read.
    const collection = getCollection(row.collection);
    if (!collection || !resolveAccess(collection.access).read({ user })) continue;
    (perCollection[row.collection] ??= {})[row.status] = row.count;
  }

  // Moderation-queue counts only matter to (and are only visible to) editor+.
  const canModerate = user?.role === 'admin' || user?.role === 'editor';
  const [pendingComments, pendingReviews] = canModerate
    ? await Promise.all([countPendingComments(db), countPendingReviews(db)])
    : [0, 0];

  return c.json({ perCollection, pendingComments, pendingReviews });
});

export { router as dashboardRouter };
