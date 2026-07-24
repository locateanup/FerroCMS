import { eq } from 'drizzle-orm';
import { entries, type Entry } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';
import type { AuthUser } from '../env.js';
import { logAudit } from './audit.js';

/**
 * Editorial workflow — orthogonal to the publish `status`: an author submits
 * a draft for review, and an editor+ approves (publishing it) or rejects it
 * (with a note, back to the author) without ever touching `status` directly.
 */
export async function submitForReview(db: Db, entry: Entry, user: AuthUser | null): Promise<Entry> {
  const [row] = await db
    .update(entries)
    .set({
      reviewStatus: 'pending',
      reviewNote: null,
      reviewRequestedAt: new Date(),
      reviewedAt: null,
      reviewedById: null,
      updatedAt: new Date(),
    })
    .where(eq(entries.id, entry.id))
    .returning();

  const updated = row!;
  await logAudit(db, {
    userId: user?.id ?? null,
    action: 'entry.submit_for_review',
    collection: updated.collection,
    entryId: updated.id,
  });
  return updated;
}

export interface ReviewDecision {
  approved: boolean;
  note?: string;
}

/** Approving also publishes the entry; rejecting leaves `status` untouched so the author can revise and resubmit. */
export async function reviewEntry(
  db: Db,
  entry: Entry,
  decision: ReviewDecision,
  user: AuthUser | null,
): Promise<Entry> {
  const now = new Date();
  const [row] = await db
    .update(entries)
    .set({
      reviewStatus: decision.approved ? 'approved' : 'rejected',
      reviewNote: decision.note ?? null,
      reviewedAt: now,
      reviewedById: user?.id ?? null,
      status: decision.approved ? 'published' : entry.status,
      publishedAt: decision.approved && entry.status !== 'published' ? now : entry.publishedAt,
      updatedAt: now,
    })
    .where(eq(entries.id, entry.id))
    .returning();

  const updated = row!;
  await logAudit(db, {
    userId: user?.id ?? null,
    action: decision.approved ? 'entry.review_approved' : 'entry.review_rejected',
    collection: updated.collection,
    entryId: updated.id,
    details: decision.note ? { note: decision.note } : undefined,
  });
  return updated;
}

/** The review queue: entries awaiting approval, oldest submission first. */
export async function listPendingReviews(db: Db, limit: number): Promise<Entry[]> {
  return db
    .select()
    .from(entries)
    .where(eq(entries.reviewStatus, 'pending'))
    .orderBy(entries.reviewRequestedAt)
    .limit(limit);
}
