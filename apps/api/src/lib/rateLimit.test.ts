import { describe, expect, it, vi } from 'vitest';
import { checkRateLimit, clientIp } from './rateLimit.js';
import type { KVAdapter } from '../platform/types.js';

function fakeKV(): KVAdapter {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    },
  };
}

describe('checkRateLimit', () => {
  it('allows requests up to the max within a window', async () => {
    const kv = fakeKV();
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(kv, 'k', { windowSeconds: 60, max: 5 });
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks requests beyond the max within the same window', async () => {
    const kv = fakeKV();
    for (let i = 0; i < 5; i++) await checkRateLimit(kv, 'k', { windowSeconds: 60, max: 5 });
    const result = await checkRateLimit(kv, 'k', { windowSeconds: 60, max: 5 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after the window expires', async () => {
    const kv = fakeKV();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    for (let i = 0; i < 5; i++) await checkRateLimit(kv, 'k', { windowSeconds: 60, max: 5 });
    expect((await checkRateLimit(kv, 'k', { windowSeconds: 60, max: 5 })).allowed).toBe(false);

    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    const result = await checkRateLimit(kv, 'k', { windowSeconds: 60, max: 5 });
    expect(result.allowed).toBe(true);
    vi.restoreAllMocks();
  });

  it('keeps separate windows per key', async () => {
    const kv = fakeKV();
    for (let i = 0; i < 5; i++) await checkRateLimit(kv, 'a', { windowSeconds: 60, max: 5 });
    const result = await checkRateLimit(kv, 'b', { windowSeconds: 60, max: 5 });
    expect(result.allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('prefers cf-connecting-ip', () => {
    const headers = new Headers({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' });
    expect(clientIp(headers)).toBe('1.2.3.4');
  });

  it('falls back to the first x-forwarded-for entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '5.6.7.8, 9.9.9.9' });
    expect(clientIp(headers)).toBe('5.6.7.8');
  });

  it('falls back to "unknown" with no headers', () => {
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
