import type { MiddlewareHandler } from 'hono';
import { eq } from 'drizzle-orm';
import { apiKeys } from '@ferrocms/db';
import type { AccessArgs, AccessFn } from '@ferrocms/core';
import type { AppBindings, AuthUser } from '../env.js';
import { createDb } from '@ferrocms/db';
import { sha256Hex } from '../lib/crypto.js';
import { errors } from '../lib/errors.js';
import { getSessionToken, readSession } from './session.js';

/** Resolve the authenticated user from a Bearer API key or session cookie. */
async function resolveUser(
  c: Parameters<MiddlewareHandler<AppBindings>>[0],
): Promise<AuthUser | null> {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice('Bearer '.length).trim();
    const hashed = await sha256Hex(key);
    const db = c.get('db');
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.hashedKey, hashed)).limit(1);
    if (!row) return null;
    // Best-effort last-used tracking; ignore failures.
    c.executionCtx.waitUntil(
      db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, row.id))
        .then(
          () => undefined,
          () => undefined,
        ),
    );
    return { id: row.id, role: row.role, via: 'apiKey' };
  }

  const token = getSessionToken(c);
  if (token) {
    const session = await readSession(c.env, token);
    if (session) {
      return { id: session.userId, role: session.role, email: session.email, via: 'session' };
    }
  }
  return null;
}

/** Attach a request-scoped db client and the resolved user to the context. */
export const contextMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  c.set('db', createDb(c.env.DATABASE_URL));
  c.set('user', await resolveUser(c));
  await next();
};

/** Require that the current user satisfies an access function, else throw. */
export function enforce(
  c: { get: (k: 'user') => AuthUser | null },
  access: AccessFn,
  id?: string,
): AuthUser | null {
  const user = c.get('user');
  const args: AccessArgs = { user: user ? { id: user.id, role: user.role } : null, id };
  if (!access(args)) {
    if (!user) throw errors.unauthorized();
    throw errors.forbidden();
  }
  return user;
}
