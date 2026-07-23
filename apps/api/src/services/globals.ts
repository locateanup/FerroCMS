import { eq } from 'drizzle-orm';
import { entries, type Entry } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';
import type { ResolvedGlobal } from '@ferrocms/core';
import type { AuthUser } from '../env.js';
import { logAudit } from './audit.js';

/**
 * Globals reuse the `entries` table (`collection` = the global's slug) rather
 * than a dedicated table — a global is just an entry that's always exactly
 * one row, created lazily on first access, with no status/draft lifecycle.
 */
async function findGlobalEntry(db: Db, slug: string): Promise<Entry | null> {
  const [row] = await db
    .select()
    .from(entries)
    .where(eq(entries.collection, slug))
    .orderBy(entries.createdAt)
    .limit(1);
  return row ?? null;
}

export async function getOrCreateGlobal(db: Db, global: ResolvedGlobal): Promise<Entry> {
  const existing = await findGlobalEntry(db, global.slug);
  if (existing) return existing;
  const [row] = await db
    .insert(entries)
    .values({ collection: global.slug, status: 'published', data: {} })
    .returning();
  return row!;
}

export async function updateGlobal(
  db: Db,
  global: ResolvedGlobal,
  data: Record<string, unknown>,
  user: AuthUser | null,
): Promise<Entry> {
  const existing = await getOrCreateGlobal(db, global);
  const merged = { ...(existing.data as Record<string, unknown>), ...data };

  const [row] = await db
    .update(entries)
    .set({ data: merged, updatedAt: new Date() })
    .where(eq(entries.id, existing.id))
    .returning();

  const updated = row!;
  await logAudit(db, {
    userId: user?.id ?? null,
    action: 'global.update',
    collection: global.slug,
    entryId: updated.id,
  });
  return updated;
}
