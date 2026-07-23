import { describe, expect, it } from 'vitest';
import app from '../index.js';

const env = {
  ADMIN_ORIGIN: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'http://127.0.0.1:8080',
  AUTH_SECRET: 'test-secret',
  MEDIA: {} as never,
};

describe('preview endpoints', () => {
  it('returns 404 for an unknown collection when minting a preview token', async () => {
    const res = await app.request('/api/nope/some-id/preview-token', { method: 'POST' }, env);
    expect(res.status).toBe(404);
  });

  it('requires a token on the preview read endpoint', async () => {
    const res = await app.request('/api/posts/some-id/preview', {}, env);
    expect(res.status).toBe(400);
  });

  it('rejects a garbage preview token without touching the database', async () => {
    const res = await app.request('/api/posts/some-id/preview?token=not-a-real-token', {}, env);
    expect(res.status).toBe(401);
  });

  it('rejects a well-formed but wrong-signature preview token', async () => {
    const fakeToken = `${Math.floor(Date.now() / 1000) + 600}.${'0'.repeat(64)}`;
    const res = await app.request(`/api/posts/some-id/preview?token=${fakeToken}`, {}, env);
    expect(res.status).toBe(401);
  });

  it('rejects an expired-looking preview token', async () => {
    const expiredToken = `1.${'0'.repeat(64)}`;
    const res = await app.request(`/api/posts/some-id/preview?token=${expiredToken}`, {}, env);
    expect(res.status).toBe(401);
  });
});
