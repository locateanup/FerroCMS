import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { authenticated } from '@ferrocms/core';
import type { Db } from '@ferrocms/db';
import type { AppBindings } from './env.js';
import type { AppConfig, CacheAdapter, KVAdapter, StorageAdapter } from './platform/types.js';
import { enforce, resolveUser } from './auth/middleware.js';
import { toErrorResponse } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { entriesRouter } from './routes/entries.js';
import { mediaRouter } from './routes/media.js';
import { usersRouter } from './routes/users.js';
import { systemRouter } from './routes/system.js';
import { auditRouter } from './routes/audit.js';
import { searchRouter } from './routes/search.js';
import { globalsRouter } from './routes/globals.js';
import { robotsHandler, sitemapHandler } from './routes/seo.js';
import { collections } from './config/collections.js';
import { yoga } from './graphql/index.js';

/** Everything a request needs, resolved per platform (Workers or Node). */
export interface PlatformContext {
  db: Db;
  storage: StorageAdapter;
  kv: KVAdapter;
  cache: CacheAdapter;
  config: AppConfig;
}

export type MakeContext = (c: Context<AppBindings>) => PlatformContext;

/**
 * Build the FerroCMS API. The `makeContext` factory supplies the runtime bits
 * (database, storage, KV, config) so the exact same app runs on Cloudflare
 * Workers or on Node.
 */
export function createApp(makeContext: MakeContext): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // Security response headers. This API only ever serves JSON, images, and
  // plain text (sitemap/robots) — never HTML — so a strict CSP is safe.
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"] },
      xContentTypeOptions: 'nosniff',
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      crossOriginResourcePolicy: 'cross-origin',
    }),
  );

  // Platform middleware — resolve runtime services and the current user first.
  app.use('*', async (c, next) => {
    const ctx = makeContext(c);
    c.set('db', ctx.db);
    c.set('storage', ctx.storage);
    c.set('kv', ctx.kv);
    c.set('cache', ctx.cache);
    c.set('config', ctx.config);
    c.set('user', await resolveUser(c));
    await next();
  });

  // CORS with credentials — echo back only explicitly allowed origins.
  app.use('*', (c, next) => {
    const cfg = c.get('config');
    const allowed = [cfg.adminOrigin, ...cfg.corsOrigins].filter(Boolean);
    return cors({
      origin: (origin) => (allowed.includes(origin) ? origin : (allowed[0] ?? '')),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    })(c, next);
  });

  app.onError((err, c) => toErrorResponse(c, err));

  app.get('/health', (c) => c.json({ status: 'ok', service: 'ferrocms-api' }));

  app.get('/sitemap.xml', sitemapHandler);
  app.get('/robots.txt', robotsHandler);

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
      taxonomyConfig: col.taxonomyConfig,
      locales: col.locales,
      defaultLocale: col.defaultLocale,
    }));
    return c.json({ items: schemas });
  });

  // GraphQL — mirrors the REST API's access control exactly (see graphql/schema.ts).
  app.on(['GET', 'POST'], '/graphql', (c) =>
    yoga.fetch(c.req.raw, { db: c.get('db'), user: c.get('user') }),
  );

  // Register specific routers before the catch-all /:collection routes.
  app.route('/api/auth', authRouter);
  app.route('/api/media', mediaRouter);
  app.route('/api/users', usersRouter);
  app.route('/api/audit-log', auditRouter);
  app.route('/api/search', searchRouter);
  app.route('/api/globals', globalsRouter);
  app.route('/api/system', systemRouter);
  app.route('/api', entriesRouter);

  return app;
}
