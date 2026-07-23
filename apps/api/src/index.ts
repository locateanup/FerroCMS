/** Cloudflare Workers entry point. */

import { createDb } from '@ferrocms/db';
import { createApp } from './app.js';
import { cfCache, configFromEnv, r2Storage } from './platform/cloudflare.js';
import { sqlKV } from './platform/kv.js';

const app = createApp((c) => {
  const db = createDb(c.env.DATABASE_URL, c.env.DATABASE_AUTH_TOKEN);
  return {
    db,
    storage: r2Storage(c.env.MEDIA),
    kv: sqlKV(db),
    cache: cfCache(),
    config: configFromEnv(c.env),
  };
});

export default app;
