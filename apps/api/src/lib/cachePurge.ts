import type { CacheAdapter, KVAdapter } from '../platform/types.js';

/**
 * Targeted cache invalidation for public reads (see entries.ts). The public
 * "one entry" cache key is deterministic (`one:<collection>:<id>`) and can be
 * deleted directly. The public "list" cache isn't — its key varies by
 * slug/limit/offset filters — so every list-cache PUT records its own key
 * here (in KV, keyed by collection), and a write purges every key that's been
 * recorded for that collection. This is exact invalidation, not a TTL wait,
 * without needing the cache backend itself to support enumeration.
 */
function keyIndexKey(collection: string): string {
  return `cachekeys:${collection}`;
}

/** Record a list-cache key as belonging to a collection, so a later write can purge it. */
export async function trackListCacheKey(
  kv: KVAdapter,
  collection: string,
  cacheKey: string,
): Promise<void> {
  const indexKey = keyIndexKey(collection);
  const raw = await kv.get(indexKey);
  const keys: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  if (keys.includes(cacheKey)) return;
  keys.push(cacheKey);
  // Bookkeeping only — self-heals even if never explicitly cleared, since the
  // underlying cache entries it points at expire on their own TTL regardless.
  await kv.put(indexKey, JSON.stringify(keys), { expirationTtl: 60 * 60 });
}

/** Purge every public cache entry for a collection: its list-cache keys and one entry's key. */
export async function purgeCollectionCache(
  cache: CacheAdapter,
  kv: KVAdapter,
  collection: string,
  entryId?: string,
): Promise<void> {
  const indexKey = keyIndexKey(collection);
  const raw = await kv.get(indexKey);
  const keys: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  await Promise.all(keys.map((key) => cache.delete(key)));
  await kv.delete(indexKey);
  if (entryId) await cache.delete(`one:${collection}:${entryId}`);
}
