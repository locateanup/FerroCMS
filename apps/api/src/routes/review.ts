import { Hono } from 'hono';
import { atLeast } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { listPendingReviews } from '../services/review.js';

const router = new Hono<AppBindings>();

// The review queue spans every collection — editor+ only.
router.get('/queue', async (c) => {
  enforce(c, atLeast('editor'));
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 200);
  const items = await listPendingReviews(c.get('db'), limit);
  return c.json({ items });
});

export { router as reviewRouter };
