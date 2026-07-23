import { Hono } from 'hono';
import { atLeast } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { listAuditLog } from '../services/audit.js';

const router = new Hono<AppBindings>();

// Admins only — the audit log can reveal who did what across every
// collection, including ones the requester might not otherwise have read
// access to.
router.get('/', async (c) => {
  enforce(c, atLeast('admin'));
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0);
  const result = await listAuditLog(c.get('db'), { limit, offset });
  return c.json(result);
});

export { router as auditRouter };
