import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

/**
 * Create a Drizzle client backed by Neon's HTTP driver. This works inside
 * Cloudflare Workers (no TCP sockets required). Pass the connection string
 * from the Worker's environment.
 */
export function createDb(connectionString: string) {
  if (!connectionString) {
    throw new Error('createDb: DATABASE_URL is empty. Set it in .dev.vars or Worker secrets.');
  }
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
