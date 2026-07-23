import { describe, expect, it } from 'vitest';
import app from '../index.js';

const env = {
  ADMIN_ORIGIN: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'http://127.0.0.1:8080',
  AUTH_SECRET: 'test-secret',
  MEDIA: {} as never,
};

describe('user management endpoints', () => {
  it('rejects anonymous access to the user list (401)', async () => {
    const res = await app.request('/api/users', {}, env);
    expect(res.status).toBe(401);
  });

  it('rejects anonymous user creation (401)', async () => {
    const res = await app.request(
      '/api/users',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com', password: 'password1' }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it('rejects anonymous user updates (401)', async () => {
    const res = await app.request(
      '/api/users/some-id',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: false }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });
});
