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

  it('preview fetches the draft entry and hits the right URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: '1', status: 'draft', data: { title: 'Draft' } }));
    const client = createClient({ url: 'https://cms.test', fetch: fetchMock });

    const entry = await client.preview('posts', 'abc', 'tok123');

    expect(entry?.status).toBe('draft');
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://cms.test/api/posts/abc/preview?token=tok123');
  });

  it('preview returns null for an invalid/expired token (401) or missing entry (404)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'unauthorized', message: 'x' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'not_found', message: 'x' } }, 404));
    const client = createClient({ url: 'https://cms.test', fetch: fetchMock });

    expect(await client.preview('posts', 'abc', 'bad-token')).toBeNull();
    expect(await client.preview('posts', 'missing', 'tok')).toBeNull();
  });

  it('getGlobal fetches the right URL and unwraps to just the data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: '1',
        collection: 'site-settings',
        data: { siteName: 'FerroCMS Demo' },
      }),
    );
    const client = createClient({ url: 'https://cms.test', fetch: fetchMock });

    const settings = await client.getGlobal<{ siteName: string }>('site-settings');

    expect(settings.siteName).toBe('FerroCMS Demo');
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://cms.test/api/globals/site-settings');
  });

  it('resolveRedirect returns the mapping, or null on 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ toPath: '/new-url', statusCode: 301 }))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'not_found', message: 'x' } }, 404),
      );
    const client = createClient({ url: 'https://cms.test', fetch: fetchMock });

    const hit = await client.resolveRedirect('/old-url');
    expect(hit).toEqual({ toPath: '/new-url', statusCode: 301 });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://cms.test/api/redirects/resolve?path=%2Fold-url');

    expect(await client.resolveRedirect('/never-existed')).toBeNull();
  });

  it('listComments fetches the right URL and returns only approved comments', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [{ id: '1', collection: 'posts', entryId: 'p1', authorName: 'Alice', body: 'Hi', approved: true }],
      }),
    );
    const client = createClient({ url: 'https://cms.test', fetch: fetchMock });

    const items = await client.listComments('posts', 'p1');

    expect(items).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://cms.test/api/comments?collection=posts&entryId=p1');
  });

  it('submitComment posts JSON to the right URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { id: '1', collection: 'posts', entryId: 'p1', authorName: 'Alice', body: 'Hi', approved: false },
        201,
      ),
    );
    const client = createClient({ url: 'https://cms.test', fetch: fetchMock });

    const comment = await client.submitComment({
      collection: 'posts',
      entryId: 'p1',
      authorName: 'Alice',
      body: 'Hi',
    });

    expect(comment.approved).toBe(false);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://cms.test/api/comments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      collection: 'posts',
      entryId: 'p1',
      authorName: 'Alice',
      body: 'Hi',
    });
  });
});
