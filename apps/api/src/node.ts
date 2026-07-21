/**
 * Node entry point — run FerroCMS anywhere (Docker, a VPS, Render, Fly, bare
 * metal). Uses filesystem storage and Postgres-backed KV instead of Cloudflare
 * R2 / Workers KV. Start with `pnpm --filter @ferrocms/api start:node`.
 */

import { serve } from '@hono/node-server';
import { createDb } from '@ferrocms/db';
import { createApp } from './app.js';
import { configFromProcessEnv, fsStorage } from './platform/node.js';
import { sqlKV } from './platform/kv.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const db = createDb(databaseUrl, process.env.DATABASE_AUTH_TOKEN);
const config = configFromProcessEnv();
const storage = fsStorage(process.env.MEDIA_DIR ?? './.ferrocms/media');
const kv = sqlKV(db);

// The context is the same for every request on Node — build it once.
const app = createApp(() => ({ db, storage, kv, config }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`FerroCMS API (Node) listening on http://localhost:${info.port}`);
});
