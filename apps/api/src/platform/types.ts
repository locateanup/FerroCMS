/**
 * Platform abstraction so the same API runs on Cloudflare Workers *or* Node
 * (Docker/VPS/any host). Runtime-specific bits — object storage, key/value, and
 * "run in the background" — sit behind these small interfaces.
 */

export interface StoredObject {
  body: ReadableStream | ArrayBuffer | Uint8Array;
  contentType?: string;
  etag?: string;
}

export interface StorageAdapter {
  put(key: string, data: ArrayBuffer, opts?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

export interface KVAdapter {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CachedResponse {
  body: string;
  contentType: string;
}

/**
 * A short-TTL response cache for public, anonymous GET reads. On Cloudflare
 * this wraps the edge Cache API; on Node it's an in-process Map. Either way
 * this is TTL-based staleness, not push-invalidated on publish — a request
 * can lag up to `ttlSeconds` behind the latest write. Never used for
 * authenticated or draft-including responses.
 */
export interface CacheAdapter {
  get(key: string): Promise<CachedResponse | null>;
  put(key: string, value: CachedResponse, ttlSeconds: number): Promise<void>;
  /** Evict one entry immediately — used for targeted invalidation on write. */
  delete(key: string): Promise<void>;
}

/** String configuration, resolved from Workers vars or process.env. */
export interface AppConfig {
  authSecret: string;
  adminOrigin: string;
  corsOrigins: string[];
  siteUrl?: string;
  webhookUrls: string[];
  webhookSecret?: string;
}
