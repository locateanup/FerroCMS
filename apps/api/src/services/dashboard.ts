import { eq, sql } from 'drizzle-orm';
import { comments, entries } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';

export interface EntryStatCount {
  collection: string;
  status: string;
  count: number;
}

/** Entry counts grouped by collection + status, in one query. */
export async function getEntryStats(db: Db): Promise<EntryStatCount[]> {
  return db
    .select({
      collection: entries.collection,
      status: entries.status,
      count: sql<number>`count(*)`,
    })
    .from(entries)
    .groupBy(entries.collection, entries.status);
}

export async function countPendingComments(db: Db): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.approved, false));
  return row?.count ?? 0;
}

export async function countPendingReviews(db: Db): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(entries)
    .where(eq(entries.reviewStatus, 'pending'));
  return row?.count ?? 0;
}
