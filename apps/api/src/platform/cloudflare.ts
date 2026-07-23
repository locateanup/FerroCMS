/** Cloudflare Workers implementations of the platform adapters. */

import type { Env } from '../env.js';
import type { AppConfig, CacheAdapter, StorageAdapter } from './types.js';

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

/** Stable synthetic URL the Cache API keys its entries on. */
function cacheRequest(key: string): Request {
  return new Request(`https://ferrocms-cache.internal/${encodeURIComponent(key)}`);
}

/** Wraps the Workers edge Cache API (`caches.default`) behind `CacheAdapter`. */
export function cfCache(): CacheAdapter {
  return {
    async get(key) {
      const match = await caches.default.match(cacheRequest(key));
      if (!match) return null;
      return {
        body: await match.text(),
        contentType: match.headers.get('content-type') ?? 'application/json',
      };
    },
    async put(key, value, ttlSeconds) {
      const response = new Response(value.body, {
        headers: {
          'content-type': value.contentType,
          'cache-control': `public, max-age=${ttlSeconds}`,
        },
      });
      await caches.default.put(cacheRequest(key), response);
    },
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
