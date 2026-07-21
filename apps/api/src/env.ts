import type { Db } from '@ferrocms/db';
import type { Role } from '@ferrocms/core';
import type { AppConfig, KVAdapter, StorageAdapter } from './platform/types.js';

/** Cloudflare bindings + secrets available to the Worker. */
export interface Env {
  /** Turso/libSQL database URL, e.g. libsql://your-db.turso.io (secret). */
  DATABASE_URL: string;
  /** Turso auth token (secret). */
  DATABASE_AUTH_TOKEN?: string;
  /** Secret for signing/deriving auth material (secret). */
  AUTH_SECRET: string;
  /** Origin of the admin SPA, used for CORS + cookies. */
  ADMIN_ORIGIN: string;
  /** Comma-separated list of additional allowed origins. */
  CORS_ORIGINS?: string;
  /** Public base URL of the front-end site, used for sitemap + canonical URLs. */
  SITE_URL?: string;
  /** Comma-separated webhook URLs notified on content changes (revalidation). */
  WEBHOOK_URLS?: string;
  /** Optional secret used to HMAC-sign webhook payloads. */
  WEBHOOK_SECRET?: string;
  /** R2 bucket for the media library. */
  MEDIA: R2Bucket;
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
  storage: StorageAdapter;
  kv: KVAdapter;
  config: AppConfig;
}

export type AppBindings = { Bindings: Env; Variables: Variables };
