import { Hono, type Context } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { oauthAccounts, users } from '@ferrocms/db';
import type { AppBindings } from '../env.js';
import { errors } from '../lib/errors.js';
import { randomToken } from '../lib/crypto.js';
import { createSession, setSessionCookie } from '../auth/session.js';
import { oauthProvidersFromConfig, type OAuthProvider } from '../lib/oauth.js';
import { checkRateLimit, clientIp } from '../lib/rateLimit.js';

const router = new Hono<AppBindings>();

const STATE_TTL_SECONDS = 10 * 60;
const START_LIMIT = { windowSeconds: 15 * 60, max: 30 };
const CALLBACK_LIMIT = { windowSeconds: 15 * 60, max: 20 };

function findProvider(c: Context<AppBindings>, id: string): OAuthProvider {
  const provider = oauthProvidersFromConfig(c.get('config')).find((p) => p.id === id);
  if (!provider) throw errors.notFound('OAuth provider');
  return provider;
}

function redirectUri(c: Context<AppBindings>, providerId: string): string {
  return `${new URL(c.req.url).origin}/api/auth/oauth/${providerId}/callback`;
}

// Which providers are actually configured — the admin only shows buttons for these.
router.get('/providers', (c) => {
  const items = oauthProvidersFromConfig(c.get('config')).map((p) => ({
    id: p.id,
    label: p.label,
  }));
  return c.json({ items });
});

// Step 1: redirect the browser to the provider with a CSRF-protecting state token.
router.get('/:provider', async (c) => {
  const provider = findProvider(c, c.req.param('provider'));

  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.get('kv'), `oauth-start:${ip}`, START_LIMIT);
  if (!limit.allowed) throw errors.tooManyRequests();

  const state = randomToken();
  await c.get('kv').put(`oauth-state:${state}`, provider.id, { expirationTtl: STATE_TTL_SECONDS });
  return c.redirect(provider.authorizeUrl(state, redirectUri(c, provider.id)));
});

// Step 2: the provider redirects back here with a code (or an error).
router.get('/:provider/callback', async (c) => {
  const provider = findProvider(c, c.req.param('provider'));

  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.get('kv'), `oauth-callback:${ip}`, CALLBACK_LIMIT);
  if (!limit.allowed) throw errors.tooManyRequests();

  const { code, state, error: providerError } = c.req.query();
  if (providerError) throw errors.badRequest(`${provider.label} sign-in was cancelled or denied.`);
  if (!code || !state) throw errors.badRequest('Missing code or state.');

  const stateKey = `oauth-state:${state}`;
  const storedProviderId = await c.get('kv').get(stateKey);
  if (!storedProviderId || storedProviderId !== provider.id) {
    throw errors.unauthorized('Invalid or expired sign-in attempt. Please try again.');
  }
  await c.get('kv').delete(stateKey); // one-time use

  const info = await provider.exchangeCode(code, redirectUri(c, provider.id));

  const db = c.get('db');
  const [existingLink] = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider.id),
        eq(oauthAccounts.providerAccountId, info.providerAccountId),
      ),
    )
    .limit(1);

  let userId: string;
  if (existingLink) {
    userId = existingLink.userId;
  } else {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, info.email))
      .limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Same policy as password registration: only the very first user can
      // self-provision. Everyone after that needs an admin invite — an OAuth
      // login can't be used to bypass that, or anyone with a Google account
      // could grant themselves access.
      const [row] = await db.select({ count: sql<number>`count(*)` }).from(users);
      if ((row?.count ?? 0) > 0) {
        throw errors.forbidden('No account found for this email. Ask an admin to invite you.');
      }
      const [created] = await db
        .insert(users)
        .values({ email: info.email, name: info.name ?? null, passwordHash: null, role: 'admin' })
        .returning();
      userId = created!.id;
    }
    await db.insert(oauthAccounts).values({
      userId,
      provider: provider.id,
      providerAccountId: info.providerAccountId,
    });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw errors.unauthorized();
  if (!user.active) throw errors.unauthorized('This account has been deactivated.');

  const token = await createSession(c.get('kv'), {
    userId: user.id,
    role: user.role,
    email: user.email,
  });
  setSessionCookie(c, token);
  return c.redirect(c.get('config').adminOrigin);
});

export { router as oauthRouter };
