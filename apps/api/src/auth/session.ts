import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Role } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import type { KVAdapter } from '../platform/types.js';
import { randomToken, sha256Hex } from '../lib/crypto.js';

export const SESSION_COOKIE = 'ferrocms_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  role: Role;
  email: string;
}

function kvKey(tokenHash: string): string {
  return `session:${tokenHash}`;
}

/** Create a session in KV and return the opaque token (store the hash, not the token). */
export async function createSession(kv: KVAdapter, payload: SessionPayload): Promise<string> {
  const token = randomToken();
  const hash = await sha256Hex(token);
  await kv.put(kvKey(hash), JSON.stringify(payload), { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}

export async function readSession(kv: KVAdapter, token: string): Promise<SessionPayload | null> {
  const hash = await sha256Hex(token);
  const raw = await kv.get(kvKey(hash));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession(kv: KVAdapter, token: string): Promise<void> {
  const hash = await sha256Hex(token);
  await kv.delete(kvKey(hash));
}

export function setSessionCookie(c: Context<AppBindings>, token: string): void {
  // Over HTTPS use SameSite=None + Secure so the admin can live on a different
  // domain than the API. Over http://localhost, Secure cookies aren't stored,
  // so fall back to Lax + insecure for a working local dev experience.
  const isHttps = new URL(c.req.url).protocol === 'https:';
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'None' : 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(c: Context<AppBindings>): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function getSessionToken(c: Context<AppBindings>): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}
