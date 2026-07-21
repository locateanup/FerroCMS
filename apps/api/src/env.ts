import type { Db } from '@ferrocms/db';
import type { Role } from '@ferrocms/core';

/** Cloudflare bindings + secrets available to the Worker. */
export interface Env {
  /** Neon Postgres connection string (secret). */
  DATABASE_URL: string;
  /** Secret for signing/deriving auth material (secret). */
  AUTH_SECRET: string;
  /** Origin of the admin SPA, used for CORS + cookies. */
  ADMIN_ORIGIN: string;
  /** Comma-separated list of additional allowed origins. */
  CORS_ORIGINS?: string;
  /** Public base URL of the front-end site, used for sitemap + canonical URLs. */
  SITE_URL?: string;
  /** R2 bucket for the media library. */
  MEDIA: R2Bucket;
  /** KV namespace for sessions and cache. */
  SESSIONS: KVNamespace;
}

export interface AuthUser {
  id: string;
  role: Role;
  email?: string;
  /** How the request authenticated. */
  via: 'session' | 'apiKey';
}

/** Per-request values stored on the Hono context. */
export interface Variables {
  db: Db;
  user: AuthUser | null;
}

export type AppBindings = { Bindings: Env; Variables: Variables };
