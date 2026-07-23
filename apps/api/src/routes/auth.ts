import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { users, type User } from '@ferrocms/db';
import type { AppBindings } from '../env.js';
import { hashPassword, randomToken, verifyPassword } from '../lib/crypto.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionToken,
  setSessionCookie,
} from '../auth/session.js';
import { errors } from '../lib/errors.js';
import { checkRateLimit, clientIp } from '../lib/rateLimit.js';
import { generateTotpSecret, totpProvisioningUri, verifyTotp } from '../lib/totp.js';

const router = new Hono<AppBindings>();

// Slow down brute-force login/registration/2FA attempts. Keyed by IP + email
// (or challenge/user) so a single stuck key can't lock out unrelated users.
const LOGIN_LIMIT = { windowSeconds: 15 * 60, max: 10 };
const REGISTER_LIMIT = { windowSeconds: 60 * 60, max: 5 };
const TOTP_LIMIT = { windowSeconds: 15 * 60, max: 10 };

/** How long a password-verified-but-awaiting-2FA login stays valid. */
const LOGIN_CHALLENGE_TTL_SECONDS = 5 * 60;

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});
const registerSchema = credsSchema.extend({ name: z.string().min(1).optional() });
const totpTokenSchema = z.object({ token: z.string().min(6).max(8) });
const totpLoginSchema = z.object({
  challengeToken: z.string().min(1),
  token: z.string().min(6).max(8),
});

function publicUser(user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'totpEnabled'>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    totpEnabled: user.totpEnabled,
  };
}

async function parse<T>(c: Context<AppBindings>, schema: z.ZodType<T>): Promise<T> {
  const raw = await c.req.json().catch(() => {
    throw errors.badRequest('Request body must be valid JSON.');
  });
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw errors.validation(
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

function requireUser(c: Context<AppBindings>) {
  const user = c.get('user');
  if (!user) throw errors.unauthorized();
  return user;
}

// First-run registration: only allowed when there are zero users. Creates an admin.
router.post('/register', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.get('kv'), `register:${ip}`, REGISTER_LIMIT);
  if (!limit.allowed) throw errors.tooManyRequests();

  const db = c.get('db');
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(users);
  if ((row?.count ?? 0) > 0) {
    throw errors.forbidden('Registration is closed. Ask an admin to invite you.');
  }
  const body = await parse(c, registerSchema);
  const passwordHash = await hashPassword(body.password);
  const [user] = await db
    .insert(users)
    .values({ email: body.email, passwordHash, name: body.name ?? null, role: 'admin' })
    .returning();

  const token = await createSession(c.get('kv'), {
    userId: user!.id,
    role: user!.role,
    email: user!.email,
  });
  setSessionCookie(c, token);
  return c.json(publicUser(user!), 201);
});

// Step 1 of login: verify the password. If 2FA is enabled, this does not
// create a session — it returns a short-lived challenge for POST /login/2fa.
router.post('/login', async (c) => {
  const body = await parse(c, credsSchema);

  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.get('kv'), `login:${ip}:${body.email}`, LOGIN_LIMIT);
  if (!limit.allowed) throw errors.tooManyRequests();

  const db = c.get('db');
  const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
  if (!user || !valid) throw errors.unauthorized('Invalid email or password.');

  if (user.totpEnabled) {
    const challengeToken = randomToken();
    await c.get('kv').put(`2fa-challenge:${challengeToken}`, JSON.stringify({ userId: user.id }), {
      expirationTtl: LOGIN_CHALLENGE_TTL_SECONDS,
    });
    return c.json({ requiresTotp: true, challengeToken });
  }

  const token = await createSession(c.get('kv'), {
    userId: user.id,
    role: user.role,
    email: user.email,
  });
  setSessionCookie(c, token);
  return c.json(publicUser(user));
});

// Step 2 of login (only when the account has 2FA enabled): exchange the
// challenge + a valid TOTP code for a real session.
router.post('/login/2fa', async (c) => {
  const body = await parse(c, totpLoginSchema);

  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(
    c.get('kv'),
    `login-2fa:${ip}:${body.challengeToken}`,
    TOTP_LIMIT,
  );
  if (!limit.allowed) throw errors.tooManyRequests();

  const challengeKey = `2fa-challenge:${body.challengeToken}`;
  const raw = await c.get('kv').get(challengeKey);
  if (!raw) throw errors.unauthorized('Login challenge expired. Please sign in again.');
  const { userId } = JSON.parse(raw) as { userId: string };

  const db = c.get('db');
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.totpEnabled || !user.totpSecret) throw errors.unauthorized();

  if (!(await verifyTotp(user.totpSecret, body.token))) {
    throw errors.unauthorized('Invalid code.');
  }

  await c.get('kv').delete(challengeKey);
  const sessionToken = await createSession(c.get('kv'), {
    userId: user.id,
    role: user.role,
    email: user.email,
  });
  setSessionCookie(c, sessionToken);
  return c.json(publicUser(user));
});

router.post('/logout', async (c) => {
  const token = getSessionToken(c);
  if (token) await destroySession(c.get('kv'), token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

router.get('/me', async (c) => {
  const current = requireUser(c);
  const db = c.get('db');
  const [user] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  if (!user) throw errors.unauthorized();
  return c.json(publicUser(user));
});

// Begin 2FA setup: generate a secret (not yet active) and return it plus an
// otpauth:// URI for authenticator apps. Call /2fa/verify to activate it.
router.post('/2fa/setup', async (c) => {
  const current = requireUser(c);
  const db = c.get('db');
  const secret = generateTotpSecret();
  await db.update(users).set({ totpSecret: secret }).where(eq(users.id, current.id));

  const [user] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  const otpauthUrl = totpProvisioningUri({
    secret,
    accountName: user!.email,
    issuer: 'FerroCMS',
  });
  return c.json({ secret, otpauthUrl });
});

// Confirm setup with a real code from the authenticator app, activating 2FA.
router.post('/2fa/verify', async (c) => {
  const current = requireUser(c);
  const body = await parse(c, totpTokenSchema);

  const limit = await checkRateLimit(c.get('kv'), `2fa-verify:${current.id}`, TOTP_LIMIT);
  if (!limit.allowed) throw errors.tooManyRequests();

  const db = c.get('db');
  const [user] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  if (!user?.totpSecret) throw errors.badRequest('Call /2fa/setup first.');
  if (!(await verifyTotp(user.totpSecret, body.token))) {
    throw errors.unauthorized('Invalid code.');
  }

  await db.update(users).set({ totpEnabled: true }).where(eq(users.id, current.id));
  return c.json({ enabled: true });
});

// Disable 2FA — requires a currently-valid code, so a stolen session alone
// can't be used to turn off the second factor.
router.post('/2fa/disable', async (c) => {
  const current = requireUser(c);
  const body = await parse(c, totpTokenSchema);

  const limit = await checkRateLimit(c.get('kv'), `2fa-disable:${current.id}`, TOTP_LIMIT);
  if (!limit.allowed) throw errors.tooManyRequests();

  const db = c.get('db');
  const [user] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  if (!user?.totpEnabled || !user.totpSecret) throw errors.badRequest('2FA is not enabled.');
  if (!(await verifyTotp(user.totpSecret, body.token))) {
    throw errors.unauthorized('Invalid code.');
  }

  await db
    .update(users)
    .set({ totpEnabled: false, totpSecret: null })
    .where(eq(users.id, current.id));
  return c.json({ enabled: false });
});

export { router as authRouter };
