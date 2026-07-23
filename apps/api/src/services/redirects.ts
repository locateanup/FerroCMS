import { eq } from 'drizzle-orm';
import { redirects, type NewRedirect, type Redirect } from '@ferrocms/db';
import type { Db } from '@ferrocms/db';

export async function listRedirects(db: Db): Promise<Redirect[]> {
  return db.select().from(redirects).orderBy(redirects.fromPath);
}

export async function getRedirect(db: Db, id: string): Promise<Redirect | null> {
  const [row] = await db.select().from(redirects).where(eq(redirects.id, id)).limit(1);
  return row ?? null;
}

export async function findRedirectByFromPath(db: Db, fromPath: string): Promise<Redirect | null> {
  const [row] = await db.select().from(redirects).where(eq(redirects.fromPath, fromPath)).limit(1);
  return row ?? null;
}

export async function createRedirect(
  db: Db,
  input: Pick<NewRedirect, 'fromPath' | 'toPath' | 'statusCode'>,
): Promise<Redirect> {
  const [row] = await db.insert(redirects).values(input).returning();
  return row!;
}

export async function updateRedirect(
  db: Db,
  id: string,
  input: Partial<Pick<NewRedirect, 'fromPath' | 'toPath' | 'statusCode'>>,
): Promise<Redirect | null> {
  const [row] = await db
    .update(redirects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(redirects.id, id))
    .returning();
  return row ?? null;
}

export async function deleteRedirect(db: Db, id: string): Promise<void> {
  await db.delete(redirects).where(eq(redirects.id, id));
}
