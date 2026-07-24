import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

/**
 * Node-only local database client — supports `file:` paths and `:memory:`,
 * unlike the fetch-based client in `client.ts` (which is Workers-compatible
 * but only speaks `libsql://`/`http(s)://`/`ws(s)://`, not local files). For
 * self-hosting on a bare Node host without a Turso account/`turso dev`, and
 * for tests. Never import this from code that also runs on Cloudflare
 * Workers — `@libsql/client`'s local-file support depends on native bindings
 * Workers can't bundle.
 */
export function createLocalDb(url: string) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}
