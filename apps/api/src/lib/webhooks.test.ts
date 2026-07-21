import { describe, expect, it, vi } from 'vitest';
import { sendWebhooks, SIGNATURE_HEADER, type WebhookEvent } from './webhooks.js';
import { hmacSha256Hex } from './crypto.js';

const event: WebhookEvent = {
  event: 'entry.published',
  collection: 'posts',
  id: 'abc',
  slug: 'hello',
  status: 'published',
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('sendWebhooks', () => {
  it('POSTs the event to every url', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await sendWebhooks({
      urls: ['https://a.com', 'https://b.com'],
      event,
      fetchImpl: fetchMock,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(event);
  });

  it('signs the payload when a secret is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await sendWebhooks({ urls: ['https://a.com'], secret: 's3cret', event, fetchImpl: fetchMock });
    const [, init] = fetchMock.mock.calls[0]!;
    const expected = await hmacSha256Hex('s3cret', init.body as string);
    expect((init.headers as Record<string, string>)[SIGNATURE_HEADER]).toBe(expected);
  });

  it('swallows delivery failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    await expect(
      sendWebhooks({ urls: ['https://a.com'], event, fetchImpl: fetchMock }),
    ).resolves.toBeUndefined();
  });
});
