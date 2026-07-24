-- Full-text search index. FTS5 isn't expressible in Drizzle's schema DSL, so
-- this migration is hand-authored rather than generated. Kept in sync by the
-- application (insert/update/delete alongside writes to `entries`), not by
-- SQL triggers — see apps/api/src/services/search.ts.
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  entry_id UNINDEXED,
  collection UNINDEXED,
  title,
  body
);
