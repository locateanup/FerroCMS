import { and, eq, lte } from 'drizzle-orm';
import { entries, type Entry } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';
import { sendWebhooks } from '../lib/webhooks.js';
import { purgeCollectionCache } from '../lib/cachePurge.js';
import { notifyAll, type EmailSender } from '../lib/notifications.js';
import { getCollection } from '../config/collections.js';
import type { AppConfig, CacheAdapter, KVAdapter } from '../platform/types.js';

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
 * everything due, purge each affected collection's public cache, then fire
 * the same on-publish webhook other publishes emit.
 */
export async function runScheduledPublish(
  db: Db,
  config: AppConfig,
  cache: CacheAdapter,
  kv: KVAdapter,
  email: EmailSender,
  now?: Date,
): Promise<number> {
  const published = await publishDueEntries(db, now);

  const collectionsPublished = new Set(published.map((entry) => entry.collection));
  await Promise.all(
    [...collectionsPublished].map((collection) => purgeCollectionCache(cache, kv, collection)),
  );
  await Promise.all(
    published.map((entry) => cache.delete(`one:${entry.collection}:${entry.id}`)),
  );

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

  await Promise.all(
    published.map((entry) => {
      const collection = getCollection(entry.collection);
      const data = entry.data as Record<string, unknown>;
      const title = collection ? data[collection.admin.useAsTitle] : undefined;
      const label = typeof title === 'string' ? title : entry.id;
      return notifyAll(
        config,
        email,
        'FerroCMS: entry published',
        `Published (scheduled): "${label}" in ${entry.collection}.`,
      );
    }),
  );

  return published.length;
}
