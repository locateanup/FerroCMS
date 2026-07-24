import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { apiKeys, users } from '@ferrocms/db';
import type { AccessArgs, AccessFn } from '@ferrocms/core';
import type { AppBindings, AuthUser } from '../env.js';
import { sha256Hex } from '../lib/crypto.js';
import { background } from '../lib/background.js';
import { errors } from '../lib/errors.js';
import { getSessionToken, readSession } from './session.js';

/**
 * Resolve the authenticated user from a Bearer API key or session cookie.
 * Expects `db` and `kv` to already be set on the context (by the platform
 * middleware in app.ts).
 */
export async function resolveUser(c: Context<AppBindings>): Promise<AuthUser | null> {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice('Bearer '.length).trim();
    const hashed = await sha256Hex(key);
    const db = c.get('db');
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.hashedKey, hashed)).limit(1);
    if (!row) return null;
    // Best-effort last-used tracking; ignore failures.
    background(c, db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)));
    return { id: row.id, role: row.role, via: 'apiKey' };
  }

  const token = getSessionToken(c);
  if (token) {
    const session = await readSession(c.get('kv'), token);
    if (session) {
      // Re-check `active` against the DB (not just the cached session payload) so
      // deactivating a user takes effect immediately instead of waiting out the
      // session TTL.
      const db = c.get('db');
      const [row] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
      if (!row || !row.active) return null;
      return { id: session.userId, role: session.role, email: session.email, via: 'session' };
    }
  }
  return null;
}

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
