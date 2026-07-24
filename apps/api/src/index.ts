/** Cloudflare Workers entry point. */

import { createDb } from '@ferrocms/db';
import { createApp } from './app.js';
import { cfCache, configFromEnv, r2Storage } from './platform/cloudflare.js';
import { sqlKV } from './platform/kv.js';
import { runScheduledPublish } from './services/scheduling.js';
import { consoleEmailProvider } from './lib/email.js';
import type { Env } from './env.js';

const app = createApp((c) => {
  const db = createDb(c.env.DATABASE_URL, c.env.DATABASE_AUTH_TOKEN);
  return {
    db,
    storage: r2Storage(c.env.MEDIA),
    kv: sqlKV(db),
    cache: cfCache(),
    config: configFromEnv(c.env),
    email: consoleEmailProvider(),
  };
});

// Same Hono instance (so tests can still call `app.request(...)`), with a
// `scheduled` handler attached for the Cron Trigger (wrangler.jsonc
// `triggers.crons`) — publishes any `'scheduled'` entries whose time has
// arrived, on the same schedule.
export default Object.assign(app, {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);
    ctx.waitUntil(
      runScheduledPublish(db, configFromEnv(env), cfCache(), sqlKV(db), consoleEmailProvider()),
    );
  },
});
