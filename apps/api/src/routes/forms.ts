import { Hono } from 'hono';
import { atLeast, authenticated, validateEntry } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import { background } from '../lib/background.js';
import { checkRateLimit, clientIp } from '../lib/rateLimit.js';
import { notifyAll } from '../lib/notifications.js';
import { forms, getForm } from '../config/forms.js';
import * as svc from '../services/forms.js';

const router = new Hono<AppBindings>();

const moderate = atLeast('editor');

// Public submissions are the abuse surface — slow down a single IP rather
// than trying to be a full spam filter (same posture as comments).
const SUBMIT_LIMIT = { windowSeconds: 15 * 60, max: 20 };

// Schemas for the admin UI to render forms/tables from.
router.get('/', async (c) => {
  enforce(c, authenticated);
  return c.json({ items: forms.map((f) => ({ slug: f.slug, name: f.name, fields: f.fields })) });
});

// Public: submit to a form. Validated against the form's own field list.
router.post('/:slug/submit', async (c) => {
  const slug = c.req.param('slug');
  const form = getForm(slug);
  if (!form) throw errors.notFound('Form');

  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.get('kv'), `form-submit:${slug}:${ip}`, SUBMIT_LIMIT);
  if (!limit.allowed) throw errors.tooManyRequests();

  const raw = await c.req.json().catch(() => {
    throw errors.badRequest('Request body must be valid JSON.');
  });
  const validation = validateEntry(form.fields, raw);
  if (!validation.success) throw errors.validation(validation.errors);

  const submission = await svc.createSubmission(c.get('db'), slug, validation.data!);
  background(
    c,
    notifyAll(
      c.get('config'),
      c.get('email'),
      `FerroCMS: new "${form.name}" submission`,
      `New submission on "${form.name}": ${JSON.stringify(validation.data)}`,
    ),
  );
  return c.json(submission, 201);
});

// Editor+: view submissions for a form.
router.get('/:slug/submissions', async (c) => {
  enforce(c, moderate);
  const slug = c.req.param('slug');
  if (!getForm(slug)) throw errors.notFound('Form');

  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 100) || 100, 1), 500);
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0);
  const items = await svc.listSubmissions(c.get('db'), slug, { limit, offset });
  return c.json({ items });
});

// Editor+: remove a submission.
router.delete('/:slug/submissions/:id', async (c) => {
  enforce(c, moderate);
  const existing = await svc.getSubmission(c.get('db'), c.req.param('id'));
  if (!existing || existing.formSlug !== c.req.param('slug')) throw errors.notFound('Submission');
  await svc.deleteSubmission(c.get('db'), existing.id);
  return c.body(null, 204);
});

export { router as formsRouter };
