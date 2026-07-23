import { and, eq, lte } from 'drizzle-orm';
import { entries, type Entry } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';
import { sendWebhooks } from '../lib/webhooks.js';
import type { AppConfig } from '../platform/types.js';

/** Publish every `'scheduled'` entry whose `scheduledAt` has arrived. */
export async function publishDueEntries(db: Db, now: Date = new Date()): Promise<Entry[]> {
  const due = await db
    .select()
    .from(entries)
    .where(and(eq(entries.status, 'scheduled'), lte(entries.scheduledAt, now)));

  const published: Entry[] = [];
  for (const entry of due) {
    const [row] = await db
      .update(entries)
      .set({ status: 'published', publishedAt: now, scheduledAt: null, updatedAt: now })
      .where(eq(entries.id, entry.id))
      .returning();
    if (row) published.push(row);
  }
  return published;
}

/**
 * The shared body behind the Workers Cron Trigger, the Node interval
 * scheduler, and the manual `/api/system/publish-scheduled` endpoint: publish
 * everything due, then fire the same on-publish webhook other publishes emit.
 */
export async function runScheduledPublish(
  db: Db,
  config: AppConfig,
  now?: Date,
): Promise<number> {
  const published = await publishDueEntries(db, now);
  if (config.webhookUrls.length > 0) {
    await Promise.all(
      published.map((entry) =>
        sendWebhooks({
          urls: config.webhookUrls,
          secret: config.webhookSecret,
          event: {
            event: 'entry.published',
            collection: entry.collection,
            id: entry.id,
            slug: entry.slug,
            status: entry.status,
            timestamp: new Date().toISOString(),
          },
        }),
      ),
    );
  }
  return published.length;
}
