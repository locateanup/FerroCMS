import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { users, type User } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';
import { atLeast, ROLES } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import { hashPassword } from '../lib/crypto.js';

const router = new Hono<AppBindings>();

// Only admins manage other users.
const adminOnly = atLeast('admin');

function adminView(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
  };
}

const roleSchema = z.enum(ROLES);
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  name: z.string().min(1).optional(),
  role: roleSchema.default('author'),
});
const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
});

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

/** Guard against locking everyone out by deactivating/demoting the last active admin. */
async function assertNotLastAdmin(
  db: Db,
  target: User,
  willStillBeActiveAdmin: boolean,
): Promise<void> {
  if (target.role !== 'admin' || !target.active || willStillBeActiveAdmin) return;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(sql`${users.role} = 'admin' and ${users.active} = 1`);
  if ((row?.count ?? 0) <= 1) {
    throw errors.badRequest('Cannot remove the last active admin.');
  }
}

// List all users (admin only).
router.get('/', async (c) => {
  enforce(c, adminOnly);
  const rows = await c.get('db').select().from(users).orderBy(users.createdAt);
  return c.json({ items: rows.map(adminView) });
});

// Create ("invite") a user — admin sets email/password/role directly.
// No email-sending integration required; share the password out of band.
router.post('/', async (c) => {
  enforce(c, adminOnly);
  const body = await parse(c, createUserSchema);
  const db = c.get('db');

  const [existing] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  if (existing) throw errors.conflict('A user with that email already exists.');

  const passwordHash = await hashPassword(body.password);
  const [user] = await db
    .insert(users)
    .values({ email: body.email, passwordHash, name: body.name ?? null, role: body.role })
    .returning();
  return c.json(adminView(user!), 201);
});

// Update a user's name/role/active status.
router.patch('/:id', async (c) => {
  enforce(c, adminOnly);
  const id = c.req.param('id');
  const body = await parse(c, updateUserSchema);
  const db = c.get('db');

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw errors.notFound('User');

  const nextRole = body.role ?? target.role;
  const nextActive = body.active ?? target.active;
  await assertNotLastAdmin(db, target, nextActive && nextRole === 'admin');

  const [updated] = await db
    .update(users)
    .set({ name: body.name ?? target.name, role: nextRole, active: nextActive })
    .where(eq(users.id, id))
    .returning();
  return c.json(adminView(updated!));
});

export { router as usersRouter };
