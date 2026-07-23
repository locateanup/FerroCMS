import { describe, expect, it } from 'vitest';
import app from '../index.js';

const env = {
  ADMIN_ORIGIN: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'http://127.0.0.1:8080',
  AUTH_SECRET: 'test-secret',
  MEDIA: {} as never,
};

interface GraphQLTestResponse {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

async function query(q: string): Promise<{ res: Response; body: GraphQLTestResponse }> {
  const res = await app.request(
    '/graphql',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: q }),
    },
    env,
  );
  const body = (await res.json()) as GraphQLTestResponse;
  return { res, body };
}

describe('GraphQL API', () => {
  it('requires authentication for the collections query', async () => {
    const { body } = await query('{ collections { slug } }');
    expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('returns NOT_FOUND for an unknown collection without touching the database', async () => {
    const { body } = await query('{ entry(collection: "nope", id: "1") { id } }');
    expect(body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND for entries() on an unknown collection', async () => {
    const { body } = await query('{ entries(collection: "nope") { total } }');
    expect(body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('returns a GraphQL error shape for a malformed query', async () => {
    const { body } = await query('{ entries(collection: ');
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors!.length).toBeGreaterThan(0);
  });

  it('still sends security response headers on /graphql', async () => {
    const { res } = await query('{ entry(collection: "nope", id: "1") { id } }');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
