import { desc, eq } from 'drizzle-orm';
import { formSubmissions, type FormSubmission } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';

export async function createSubmission(
  db: Db,
  formSlug: string,
  data: Record<string, unknown>,
): Promise<FormSubmission> {
  const [row] = await db.insert(formSubmissions).values({ formSlug, data }).returning();
  return row!;
}

export async function listSubmissions(
  db: Db,
  formSlug: string,
  opts: { limit: number; offset: number },
): Promise<FormSubmission[]> {
  return db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.formSlug, formSlug))
    .orderBy(desc(formSubmissions.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);
}

export async function getSubmission(db: Db, id: string): Promise<FormSubmission | null> {
  const [row] = await db.select().from(formSubmissions).where(eq(formSubmissions.id, id)).limit(1);
  return row ?? null;
}

export async function deleteSubmission(db: Db, id: string): Promise<void> {
  await db.delete(formSubmissions).where(eq(formSubmissions.id, id));
}
