/**
 * Lightweight "who else is here" presence — not live character-by-character
 * collaborative editing (that needs a persistent connection and an
 * operational-transform/CRDT merge strategy, which would also mean
 * Durable-Objects-only on Cloudflare and no Node equivalent, breaking this
 * project's same-codebase-everywhere principle). Built entirely on the
 * existing KVAdapter (short-TTL heartbeats, `list()` by key prefix), so it
 * works identically on Workers and Node with no new platform primitive.
 */

import type { KVAdapter } from '../platform/types.js';

export interface PresenceEntry {
  userId: string;
  email: string;
  role: string;
  lastSeen: string;
}

/** Client re-sends a heartbeat every ~8s; this covers a couple of missed beats. */
const HEARTBEAT_TTL_SECONDS = 20;

function presenceKey(collection: string, id: string, userId: string): string {
  return `presence:${collection}:${id}:${userId}`;
}

export async function heartbeat(
  kv: KVAdapter,
  collection: string,
  id: string,
  user: { id: string; email?: string; role: string },
): Promise<void> {
  const entry: PresenceEntry = {
    userId: user.id,
    email: user.email ?? 'unknown',
    role: user.role,
    lastSeen: new Date().toISOString(),
  };
  await kv.put(presenceKey(collection, id, user.id), JSON.stringify(entry), {
    expirationTtl: HEARTBEAT_TTL_SECONDS,
  });
}

export async function leave(
  kv: KVAdapter,
  collection: string,
  id: string,
  userId: string,
): Promise<void> {
  await kv.delete(presenceKey(collection, id, userId));
}

export async function listViewers(
  kv: KVAdapter,
  collection: string,
  id: string,
): Promise<PresenceEntry[]> {
  const rows = await kv.list(`presence:${collection}:${id}:`);
  return rows.map((row) => JSON.parse(row.value) as PresenceEntry);
}
