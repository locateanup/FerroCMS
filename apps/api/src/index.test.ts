import { describe, expect, it } from 'vitest';
import app from './index.js';

const env = {
  ADMIN_ORIGIN: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'http://127.0.0.1:8080',
  AUTH_SECRET: 'test-secret',
  MEDIA: {} as never,
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

  it('sends security response headers', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
  });
});
