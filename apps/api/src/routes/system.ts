import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { errors } from '../lib/errors.js';
import { runScheduledPublish } from '../services/scheduling.js';

const router = new Hono<AppBindings>();

/**
 * Trigger the scheduled-publish sweep over HTTP. The Cloudflare Cron Trigger
 * calls `runScheduledPublish` directly (see index.ts) and never hits this
 * route; this exists for the Node runtime and any other host where an
 * external scheduler (systemd timer, host cron, uptime pinger) needs an
 * endpoint to hit instead. Authenticated by the same secret used to sign
 * sessions/tokens — not by user role, since the caller is a machine, not an
 * admin.
 */
router.post('/publish-scheduled', async (c) => {
  const auth = c.req.header('Authorization');
  if (auth !== `Bearer ${c.get('config').authSecret}`) throw errors.unauthorized();

  const published = await runScheduledPublish(
    c.get('db'),
    c.get('config'),
    c.get('cache'),
    c.get('kv'),
    c.get('email'),
  );
  return c.json({ published });
});

export { router as systemRouter };
