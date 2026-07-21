import { describe, expect, it, vi } from 'vitest';
import { createClient, FerroCmsError } from './index.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createClient', () => {
  it('lists entries and sends the API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [{ id: '1', data: { title: 'Hi' } }],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    );
    const client = createClient({ url: 'https://cms.test/', apiKey: 'secret', fetch: fetchMock });

    const result = await client.find('posts', { limit: 20 });

    expect(result.items).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://cms.test/api/posts?limit=20');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer secret');
  });

  it('findBySlug returns the first match or null', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ id: '9', slug: 'hello' }], total: 1, limit: 1, offset: 0 }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, limit: 1, offset: 0 }));
    const client = createClient({ url: 'https://cms.test', fetch: fetchMock });

    expect((await client.findBySlug('posts', 'hello'))?.id).toBe('9');
    expect(await client.findBySlug('posts', 'missing')).toBeNull();
  });

  it('findOne returns null on 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: 'not_found', message: 'Entry not found.' } }, 404),
      );
    const client = createClient({ url: 'https://cms.test', fetch: fetchMock });

    expect(await client.findOne('posts', 'nope')).toBeNull();
  });

  it('throws FerroCmsError on other failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { code: 'unauthorized', message: 'Nope.' } }, 401));
    const client = createClient({ url: 'https://cms.test', fetch: fetchMock });

    await expect(client.find('posts')).rejects.toBeInstanceOf(FerroCmsError);
  });

  it('builds media URLs', () => {
    const client = createClient({ url: 'https://cms.test/', fetch: vi.fn() });
    expect(client.mediaUrl('2026/abc.png')).toBe('https://cms.test/api/media/file/2026/abc.png');
  });
});
