import { describe, expect, it } from 'vitest';
import app from '../index.js';

const env = {
  ADMIN_ORIGIN: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'http://127.0.0.1:8080',
  AUTH_SECRET: 'test-secret',
  MEDIA: {} as never,
};

describe('oauth endpoints', () => {
  it('lists no providers when none are configured', async () => {
    const res = await app.request('/api/auth/oauth/providers', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it('404s for an unconfigured/unknown provider', async () => {
    const res = await app.request('/api/auth/oauth/not-a-real-provider', {}, env);
    expect(res.status).toBe(404);
  });

  it('404s the callback for an unconfigured provider too', async () => {
    const res = await app.request('/api/auth/oauth/not-a-real-provider/callback', {}, env);
    expect(res.status).toBe(404);
  });
});
