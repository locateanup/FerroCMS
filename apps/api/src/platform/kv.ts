/**
 * Database-backed KV, used by both runtimes (Workers and Node). Since libSQL
 * runs everywhere, sessions/cache live in the `kv` table — no separate KV
 * service to provision.
 */

import { eq } from 'drizzle-orm';
import { kv as kvTable, type Db } from '@ferrocms/db';
import type { KVAdapter } from './types.js';

export function sqlKV(db: Db): KVAdapter {
  return {
    async get(key) {
      const [row] = await db.select().from(kvTable).where(eq(kvTable.key, key)).limit(1);
      if (!row) return null;
      if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
        await db.delete(kvTable).where(eq(kvTable.key, key));
        return null;
      }
      return row.value;
    },
    async put(key, value, opts) {
      const expiresAt = opts?.expirationTtl
        ? new Date(Date.now() + opts.expirationTtl * 1000)
        : null;
      await db
        .insert(kvTable)
        .values({ key, value, expiresAt })
        .onConflictDoUpdate({ target: kvTable.key, set: { value, expiresAt } });
    },
    async delete(key) {
      await db.delete(kvTable).where(eq(kvTable.key, key));
    },
  };
}
