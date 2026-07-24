import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { atLeast } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import { background } from '../lib/background.js';
import { checkRateLimit, clientIp } from '../lib/rateLimit.js';
import { notifyAll } from '../lib/notifications.js';
import { getCollection } from '../config/collections.js';
import * as entriesSvc from '../services/entries.js';
import * as svc from '../services/comments.js';

const router = new Hono<AppBindings>();

const moderate = atLeast('editor');

// Public submissions are the abuse surface here — slow down a single IP
// hammering the endpoint rather than trying to be a full spam filter.
const SUBMIT_LIMIT = { windowSeconds: 15 * 60, max: 10 };

const submitSchema = z.object({
  collection: z.string().min(1),
  entryId: z.string().min(1),
  authorName: z.string().trim().min(1).max(100),
  authorEmail: z.string().trim().email().max(200).optional(),
  body: z.string().trim().min(1).max(2000),
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

// Public: read the approved comments on one entry.
router.get('/', async (c) => {
  const collection = c.req.query('collection');
  const entryId = c.req.query('entryId');
  if (!collection || !entryId) {
    throw errors.badRequest('Missing "collection" and/or "entryId" query parameters.');
  }
  const items = await svc.listApprovedComments(c.get('db'), collection, entryId);
  return c.json({ items });
});

// Public: submit a comment. Always lands unapproved — moderation publishes it.
router.post('/', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.get('kv'), `comment:${ip}`, SUBMIT_LIMIT);
  if (!limit.allowed) throw errors.tooManyRequests();

  const body = await parseBody(c, submitSchema);

  const collectionDef = getCollection(body.collection);
  if (!collectionDef) throw errors.notFound('Collection');
  const entry = await entriesSvc.getEntry(c.get('db'), body.collection, body.entryId);
  if (!entry || entry.status !== 'published') throw errors.notFound('Entry');

  const comment = await svc.createComment(c.get('db'), {
    collection: body.collection,
    entryId: body.entryId,
    authorName: body.authorName,
    authorEmail: body.authorEmail ?? null,
    body: body.body,
  });
  background(
    c,
    notifyAll(
      c.get('config'),
      c.get('email'),
      'FerroCMS: new comment awaiting moderation',
      `${body.authorName} commented on ${body.collection}/${body.entryId}: "${body.body}"`,
    ),
  );
  return c.json(comment, 201);
});

// Moderation queue — comments awaiting approval, across all entries.
router.get('/pending', async (c) => {
  enforce(c, moderate);
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 200);
  const items = await svc.listPendingComments(c.get('db'), limit);
  return c.json({ items });
});

// Approve a pending comment, publishing it.
router.patch('/:id', async (c) => {
  enforce(c, moderate);
  const existing = await svc.getComment(c.get('db'), c.req.param('id'));
  if (!existing) throw errors.notFound('Comment');
  const updated = await svc.approveComment(c.get('db'), existing.id);
  return c.json(updated);
});

// Reject/remove a comment (spam, or an approved one taken back down).
router.delete('/:id', async (c) => {
  enforce(c, moderate);
  const existing = await svc.getComment(c.get('db'), c.req.param('id'));
  if (!existing) throw errors.notFound('Comment');
  await svc.deleteComment(c.get('db'), existing.id);
  return c.body(null, 204);
});

export { router as commentsRouter };
