import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fsStorage, memoryCache } from './node.js';

const root = await mkdtemp(join(tmpdir(), 'ferrocms-storage-'));
const storage = fsStorage(root);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('fsStorage', () => {
  it('stores, reads, and deletes an object with its content type', async () => {
    const key = '2026/test.txt';
    const bytes = new TextEncoder().encode('hello world');
    const data = bytes.buffer.slice(0) as ArrayBuffer;

    await storage.put(key, data, { contentType: 'text/plain' });

    const obj = await storage.get(key);
    expect(obj).not.toBeNull();
    expect(obj?.contentType).toBe('text/plain');
    const readBytes = obj!.body as Uint8Array;
    expect(new TextDecoder().decode(readBytes)).toBe('hello world');

    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it('returns null for a missing key', async () => {
    expect(await storage.get('nope/missing.png')).toBeNull();
  });
});

describe('memoryCache', () => {
  afterEach(() => vi.restoreAllMocks());

  it('stores and retrieves a value', async () => {
    const cache = memoryCache();
    await cache.put('k', { body: '{"a":1}', contentType: 'application/json' }, 60);
    expect(await cache.get('k')).toEqual({ body: '{"a":1}', contentType: 'application/json' });
  });

  it('returns null for a key that was never set', async () => {
    const cache = memoryCache();
    expect(await cache.get('missing')).toBeNull();
  });

  it('expires an entry after its TTL', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const cache = memoryCache();
    await cache.put('k', { body: 'x', contentType: 'text/plain' }, 30);

    vi.spyOn(Date, 'now').mockReturnValue(now + 29_000);
    expect(await cache.get('k')).not.toBeNull();

    vi.spyOn(Date, 'now').mockReturnValue(now + 31_000);
    expect(await cache.get('k')).toBeNull();
  });

  it('keeps separate instances independent', async () => {
    const a = memoryCache();
    const b = memoryCache();
    await a.put('k', { body: 'from-a', contentType: 'text/plain' }, 60);
    expect(await b.get('k')).toBeNull();
  });

  it('deletes an entry immediately', async () => {
    const cache = memoryCache();
    await cache.put('k', { body: 'x', contentType: 'text/plain' }, 60);
    await cache.delete('k');
    expect(await cache.get('k')).toBeNull();
  });
});
