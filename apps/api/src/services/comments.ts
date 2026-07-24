import { and, desc, eq } from 'drizzle-orm';
import { comments, type Comment, type NewComment } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';

/** Approved comments for one entry, oldest first (natural reading order). */
export async function listApprovedComments(
  db: Db,
  collection: string,
  entryId: string,
): Promise<Comment[]> {
  return db
    .select()
    .from(comments)
    .where(
      and(eq(comments.collection, collection), eq(comments.entryId, entryId), eq(comments.approved, true)),
    )
    .orderBy(comments.createdAt);
}

/** The moderation queue: comments awaiting approval, newest first. */
export async function listPendingComments(db: Db, limit: number): Promise<Comment[]> {
  return db
    .select()
    .from(comments)
    .where(eq(comments.approved, false))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
}

export async function getComment(db: Db, id: string): Promise<Comment | null> {
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return row ?? null;
}

export async function createComment(
  db: Db,
  input: Pick<NewComment, 'collection' | 'entryId' | 'authorName' | 'authorEmail' | 'body'>,
): Promise<Comment> {
  const [row] = await db.insert(comments).values({ ...input, approved: false }).returning();
  return row!;
}

export async function approveComment(db: Db, id: string): Promise<Comment | null> {
  const [row] = await db.update(comments).set({ approved: true }).where(eq(comments.id, id)).returning();
  return row ?? null;
}

export async function deleteComment(db: Db, id: string): Promise<void> {
  await db.delete(comments).where(eq(comments.id, id));
}
