import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fsStorage } from './node.js';

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
