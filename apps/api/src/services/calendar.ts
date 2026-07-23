import { and, eq, gte, lte, or } from 'drizzle-orm';
import { entries, type Entry } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';

/**
 * Entries with a date to show on the content calendar: scheduled ones (by
 * `scheduledAt`) and published ones (by `publishedAt`), across every
 * collection, within `[from, to]`.
 */
export async function listCalendarEntries(db: Db, from: Date, to: Date): Promise<Entry[]> {
  return db
    .select()
    .from(entries)
    .where(
      or(
        and(eq(entries.status, 'scheduled'), gte(entries.scheduledAt, from), lte(entries.scheduledAt, to)),
        and(eq(entries.status, 'published'), gte(entries.publishedAt, from), lte(entries.publishedAt, to)),
      ),
    );
}
