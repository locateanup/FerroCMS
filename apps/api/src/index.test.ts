import { describe, expect, it } from 'vitest';
import app from './index.js';

const env = {
  ADMIN_ORIGIN: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pass@ep-test.us-east-1.aws.neon.tech/ferrocms',
  AUTH_SECRET: 'test-secret',
  MEDIA: {} as never,
  SESSIONS: {} as never,
};

describe('app', () => {
  it('serves the health check', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', service: 'ferrocms-api' });
  });

  it('echoes an allowed CORS origin', async () => {
    const res = await app.request('/health', { headers: { Origin: 'http://localhost:3000' } }, env);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('requires auth for the collections schema', async () => {
    const res = await app.request('/api/collections', {}, env);
    expect(res.status).toBe(401);
  });
});
