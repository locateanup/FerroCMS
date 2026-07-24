/**
 * Node entry point — run FerroCMS anywhere (Docker, a VPS, Render, Fly, bare
 * metal). Uses filesystem storage instead of Cloudflare R2; sessions/cache
 * live in the same libSQL database. Start with
 * `pnpm --filter @ferrocms/api start:node`.
 */

import { serve } from '@hono/node-server';
import { createDb, type Db } from '@ferrocms/db';
import { createLocalDb } from '@ferrocms/db/local';
import { createApp } from './app.js';
import { configFromProcessEnv, fsStorage, memoryCache } from './platform/node.js';
import { sqlKV } from './platform/kv.js';
import { runScheduledPublish } from './services/scheduling.js';
import { consoleEmailProvider } from './lib/email.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

// Turso/`turso dev` URLs (libsql://, http(s)://, ws(s)://) use the Workers-safe
// fetch client shared with the Cloudflare entry point; a local file or
// `:memory:` — for self-hosting without any Turso account, and for tests —
// needs the Node-native client instead (only available here, never on Workers).
const isLocalFile = databaseUrl.startsWith('file:') || databaseUrl === ':memory:';
const db: Db = isLocalFile
  ? createLocalDb(databaseUrl)
  : createDb(databaseUrl, process.env.DATABASE_AUTH_TOKEN);
const config = configFromProcessEnv();
const storage = fsStorage(process.env.MEDIA_DIR ?? './.ferrocms/media');
const kv = sqlKV(db);
const cache = memoryCache();
const email = consoleEmailProvider();

// The context is the same for every request on Node — build it once.
const app = createApp(() => ({ db, storage, kv, cache, config, email }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`FerroCMS API (Node) listening on http://localhost:${info.port}`);
});

// No external cron on a bare Node host — poll for due scheduled entries
// in-process instead. (On Cloudflare this is a Cron Trigger; see index.ts.)
const SCHEDULE_SWEEP_INTERVAL_MS = 60_000;
setInterval(() => {
  runScheduledPublish(db, config, cache, kv, email).catch((err) => {
    console.error('Scheduled-publish sweep failed:', err);
  });
}, SCHEDULE_SWEEP_INTERVAL_MS);
