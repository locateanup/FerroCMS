/** Node (Docker/VPS/any host) implementations of the platform adapters. */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { eq } from 'drizzle-orm';
import { kv as kvTable, type Db } from '@ferrocms/db';
import type { AppConfig, KVAdapter, StorageAdapter } from './types.js';

/** Filesystem-backed object storage (swap for S3 in production if desired). */
export function fsStorage(root: string): StorageAdapter {
  const pathFor = (key: string) => join(root, key);
  return {
    async put(key, data, opts) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, Buffer.from(data));
      if (opts?.contentType) await writeFile(`${path}.type`, opts.contentType);
    },
    async get(key) {
      const path = pathFor(key);
      try {
        const buf = await readFile(path);
        let contentType: string | undefined;
        try {
          contentType = (await readFile(`${path}.type`)).toString();
        } catch {
          /* no sidecar */
        }
        return { body: new Uint8Array(buf), contentType };
      } catch {
        return null;
      }
    },
    async delete(key) {
      const path = pathFor(key);
      await rm(path, { force: true });
      await rm(`${path}.type`, { force: true });
    },
  };
}

/** Postgres-backed KV (durable sessions/cache without Cloudflare KV). */
export function pgKV(db: Db): KVAdapter {
  return {
    async get(key) {
      const [row] = await db.select().from(kvTable).where(eq(kvTable.key, key)).limit(1);
      if (!row) return null;
      if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
        await db.delete(kvTable).where(eq(kvTable.key, key));
        return null;
      }
      return row.value;
    },
    async put(key, value, opts) {
      const expiresAt = opts?.expirationTtl
        ? new Date(Date.now() + opts.expirationTtl * 1000)
        : null;
      await db
        .insert(kvTable)
        .values({ key, value, expiresAt })
        .onConflictDoUpdate({ target: kvTable.key, set: { value, expiresAt } });
    },
    async delete(key) {
      await db.delete(kvTable).where(eq(kvTable.key, key));
    },
  };
}

function csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function configFromProcessEnv(): AppConfig {
  const env = process.env;
  if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET is required.');
  return {
    authSecret: env.AUTH_SECRET,
    adminOrigin: env.ADMIN_ORIGIN ?? 'http://localhost:5173',
    corsOrigins: csv(env.CORS_ORIGINS),
    siteUrl: env.SITE_URL,
    webhookUrls: csv(env.WEBHOOK_URLS),
    webhookSecret: env.WEBHOOK_SECRET,
  };
}
