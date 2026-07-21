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

/** String configuration, resolved from Workers vars or process.env. */
export interface AppConfig {
  authSecret: string;
  adminOrigin: string;
  corsOrigins: string[];
  siteUrl?: string;
  webhookUrls: string[];
  webhookSecret?: string;
}
