import type { Db } from '@ferrocms/db';
import type { Role } from '@ferrocms/core';
import type { AppConfig, CacheAdapter, KVAdapter, StorageAdapter } from './platform/types.js';
import type { EmailProvider } from './lib/email.js';

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
  /** Slack/Discord incoming webhook URLs for publish/comment/review notifications. */
  SLACK_WEBHOOK_URL?: string;
  DISCORD_WEBHOOK_URL?: string;
  /** Address notified by email on the same events. */
  NOTIFY_EMAIL_TO?: string;
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
  cache: CacheAdapter;
  config: AppConfig;
  email: EmailProvider;
}

export type AppBindings = { Bindings: Env; Variables: Variables };
