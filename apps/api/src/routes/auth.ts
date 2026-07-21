import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { users, type User } from '@ferrocms/db';
import type { AppBindings } from '../env.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionToken,
  setSessionCookie,
} from '../auth/session.js';
import { errors } from '../lib/errors.js';

const router = new Hono<AppBindings>();

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});
const registerSchema = credsSchema.extend({ name: z.string().min(1).optional() });

function publicUser(user: Pick<User, 'id' | 'email' | 'name' | 'role'>) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
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

// First-run registration: only allowed when there are zero users. Creates an admin.
router.post('/register', async (c) => {
  const db = c.get('db');
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
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

router.post('/login', async (c) => {
  const body = await parse(c, credsSchema);
  const db = c.get('db');
  const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
  if (!user || !valid) throw errors.unauthorized('Invalid email or password.');

  const token = await createSession(c.get('kv'), {
    userId: user.id,
    role: user.role,
    email: user.email,
  });
  setSessionCookie(c, token);
  return c.json(publicUser(user));
});

router.post('/logout', async (c) => {
  const token = getSessionToken(c);
  if (token) await destroySession(c.get('kv'), token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

router.get('/me', async (c) => {
  const current = c.get('user');
  if (!current) throw errors.unauthorized();
  const db = c.get('db');
  const [user] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  if (!user) throw errors.unauthorized();
  return c.json(publicUser(user));
});

export { router as authRouter };
