/** Cloudflare Workers implementations of the platform adapters. */

import type { Env } from '../env.js';
import type { AppConfig, KVAdapter, StorageAdapter } from './types.js';

export function r2Storage(bucket: R2Bucket): StorageAdapter {
  return {
    async put(key, data, opts) {
      await bucket.put(key, data, { httpMetadata: { contentType: opts?.contentType } });
    },
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) return null;
      return { body: obj.body, contentType: obj.httpMetadata?.contentType, etag: obj.httpEtag };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}

export function kvFromNamespace(ns: KVNamespace): KVAdapter {
  return {
    get: (key) => ns.get(key),
    put: (key, value, opts) => ns.put(key, value, { expirationTtl: opts?.expirationTtl }),
    delete: (key) => ns.delete(key),
  };
}

function csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function configFromEnv(env: Env): AppConfig {
  return {
    authSecret: env.AUTH_SECRET,
    adminOrigin: env.ADMIN_ORIGIN,
    corsOrigins: csv(env.CORS_ORIGINS),
    siteUrl: env.SITE_URL,
    webhookUrls: csv(env.WEBHOOK_URLS),
    webhookSecret: env.WEBHOOK_SECRET,
  };
}
