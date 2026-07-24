/** Node (Docker/VPS/any host) implementations of the platform adapters. */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AppConfig, CacheAdapter, CachedResponse, StorageAdapter } from './types.js';

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

/**
 * In-process TTL cache for Node — no shared/edge cache to reach for, but a
 * real, working cache within a single server process. Create once and reuse
 * across requests (a fresh call makes a fresh, empty cache).
 */
export function memoryCache(): CacheAdapter {
  const store = new Map<string, { value: CachedResponse; expiresAt: number }>();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key, value, ttlSeconds) {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async delete(key) {
      store.delete(key);
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
    slackWebhookUrl: env.SLACK_WEBHOOK_URL,
    discordWebhookUrl: env.DISCORD_WEBHOOK_URL,
    notifyEmailTo: env.NOTIFY_EMAIL_TO,
  };
}
