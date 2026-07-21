import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppBindings } from './env.js';
import { contextMiddleware, enforce } from './auth/middleware.js';
import { toErrorResponse } from './lib/errors.js';
import { authenticated } from '@ferrocms/core';
import { authRouter } from './routes/auth.js';
import { entriesRouter } from './routes/entries.js';
import { mediaRouter } from './routes/media.js';
import { collections } from './config/collections.js';

const app = new Hono<AppBindings>();

// CORS with credentials — echo back only explicitly allowed origins.
app.use('*', (c, next) => {
  const allowed = [c.env.ADMIN_ORIGIN, ...(c.env.CORS_ORIGINS?.split(',') ?? [])]
    .map((s) => s.trim())
    .filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : (allowed[0] ?? '')),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })(c, next);
});

// Structured error responses for everything below.
app.onError((err, c) => toErrorResponse(c, err));

// Health check — no DB required.
app.get('/health', (c) => c.json({ status: 'ok', service: 'ferrocms-api' }));

// Everything under /api gets a request-scoped db + resolved user.
app.use('/api/*', contextMiddleware);

// Collection schemas for the admin UI to render forms (functions are omitted).
app.get('/api/collections', (c) => {
  enforce(c, authenticated);
  const schemas = collections.map((col) => ({
    slug: col.slug,
    labels: col.labels,
    fields: col.fields,
    admin: col.admin,
    drafts: col.drafts,
    timestamps: col.timestamps,
  }));
  return c.json({ items: schemas });
});

// Register specific routers before the catch-all /:collection routes.
app.route('/api/auth', authRouter);
app.route('/api/media', mediaRouter);
app.route('/api', entriesRouter);

export default app;
