/** Cloudflare Workers entry point. */

import { createDb } from '@ferrocms/db';
import { createApp } from './app.js';
import { configFromEnv, kvFromNamespace, r2Storage } from './platform/cloudflare.js';

const app = createApp((c) => ({
  db: createDb(c.env.DATABASE_URL),
  storage: r2Storage(c.env.MEDIA),
  kv: kvFromNamespace(c.env.SESSIONS),
  config: configFromEnv(c.env),
}));

export default app;
