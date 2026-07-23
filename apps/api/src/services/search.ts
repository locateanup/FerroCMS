import { sql } from 'drizzle-orm';
import type { Db, Entry } from '@ferrocms/db';
import type { ResolvedCollection } from '@ferrocms/core';

/**
 * Extract every string leaf from an entry's JSON `data` (field values, and —
 * since rich-text is stored as block JSON, not markup — the text inside each
 * block too). Skips the `type` key, which is a block/discriminator tag, not
 * content. Good enough for full-text search without a dedicated rich-text
 * plain-text renderer.
 */
function extractText(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) extractText(item, out);
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key === 'type') continue;
      extractText(v, out);
    }
  }
}

const MAX_BODY_LENGTH = 20_000;

/** Keep `search_index` (see migrations/0004_search_index_fts5.sql) in sync with one entry. */
export async function indexEntry(
  db: Db,
  collection: ResolvedCollection,
  entry: Entry,
): Promise<void> {
  const data = entry.data as Record<string, unknown>;
  const titleField = collection.admin.useAsTitle;
  const title = typeof data[titleField] === 'string' ? (data[titleField] as string) : '';

  const parts: string[] = [];
  extractText(data, parts);
  const body = parts.join(' ').slice(0, MAX_BODY_LENGTH);

  await db.run(sql`delete from search_index where entry_id = ${entry.id}`);
  await db.run(
    sql`insert into search_index (entry_id, collection, title, body) values (${entry.id}, ${collection.slug}, ${title}, ${body})`,
  );
}

export async function removeFromIndex(db: Db, entryId: string): Promise<void> {
  await db.run(sql`delete from search_index where entry_id = ${entryId}`);
}

/** Turn free-text user input into a safe FTS5 MATCH query: quoted, prefix-matched terms. */
function toFtsQuery(raw: string): string {
  const terms = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10);
  return terms.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ');
}

export interface SearchHit {
  entryId: string;
  collection: string;
  title: string;
  snippet: string;
}

export async function searchEntries(db: Db, query: string, limit: number): Promise<SearchHit[]> {
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) return [];

  const rows = await db.all<{
    entry_id: string;
    collection: string;
    title: string;
    snippet: string;
  }>(
    sql`
      select
        entry_id,
        collection,
        title,
        snippet(search_index, 3, '[', ']', '…', 12) as snippet
      from search_index
      where search_index match ${ftsQuery}
      order by rank
      limit ${limit}
    `,
  );

  return rows.map((row) => ({
    entryId: row.entry_id,
    collection: row.collection,
    title: row.title,
    snippet: row.snippet,
  }));
}
