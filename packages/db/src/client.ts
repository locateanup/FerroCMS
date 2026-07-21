import { createClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

/**
 * Create a Drizzle client backed by libSQL (Turso). The web client is
 * fetch-based, so it runs in Cloudflare Workers *and* Node. Point `url` at a
 * Turso database (`libsql://…`) or a local `turso dev` server (`http://…`).
 */
export function createDb(url: string, authToken?: string) {
  if (!url) {
    throw new Error('createDb: DATABASE_URL is empty. Set it in .dev.vars or your environment.');
  }
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
