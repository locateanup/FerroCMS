import { desc } from 'drizzle-orm';
import { auditLog, type AuditLogEntry } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';

export interface AuditInput {
  userId: string | null;
  action: string;
  collection?: string | null;
  entryId?: string | null;
  details?: Record<string, unknown>;
}

/** Record one audit event. Awaited, not backgrounded — unlike webhooks, this is
 * our own database and callers should know if it failed to write. */
export async function logAudit(db: Db, entry: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    userId: entry.userId,
    action: entry.action,
    collection: entry.collection ?? null,
    entryId: entry.entryId ?? null,
    details: entry.details ?? null,
  });
}

export async function listAuditLog(
  db: Db,
  opts: { limit: number; offset: number },
): Promise<{ items: AuditLogEntry[] }> {
  const items = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);
  return { items };
}
