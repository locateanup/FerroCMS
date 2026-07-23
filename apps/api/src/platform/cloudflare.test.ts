import { afterEach, describe, expect, it, vi } from 'vitest';
import { cfCache } from './cloudflare.js';

/** Minimal fake of the Workers Cache API (`caches.default`), backed by a Map. */
function fakeCacheStorage() {
  const store = new Map<string, Response>();
  return {
    async match(request: Request) {
      return store.get(request.url) ?? undefined;
    },
    async put(request: Request, response: Response) {
      store.set(request.url, response.clone());
    },
  };
}

describe('cfCache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null on a miss', async () => {
    vi.stubGlobal('caches', { default: fakeCacheStorage() });
    const cache = cfCache();
    expect(await cache.get('nope')).toBeNull();
  });

  it('stores and retrieves a value with its content type', async () => {
    vi.stubGlobal('caches', { default: fakeCacheStorage() });
    const cache = cfCache();

    await cache.put('k', { body: '{"a":1}', contentType: 'application/json' }, 30);
    const result = await cache.get('k');

    expect(result?.body).toBe('{"a":1}');
    expect(result?.contentType).toBe('application/json');
  });

  it('keys entries independently', async () => {
    vi.stubGlobal('caches', { default: fakeCacheStorage() });
    const cache = cfCache();

    await cache.put('a', { body: 'A', contentType: 'text/plain' }, 30);
    await cache.put('b', { body: 'B', contentType: 'text/plain' }, 30);

    expect((await cache.get('a'))?.body).toBe('A');
    expect((await cache.get('b'))?.body).toBe('B');
  });
});
