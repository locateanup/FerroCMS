# Upgrading & migrations

FerroCMS is pre-1.0 and moving fast — there is no versioned `/api/v1` deprecation policy yet, and
breaking changes to the config API or database schema can land between releases. Until 1.0, treat
`main` as the only supported version and pull updates regularly rather than letting a fork drift far
behind.

## Database migrations

Schema changes live as versioned, numbered SQL files in `packages/db/migrations/` (Drizzle Kit),
generated from `packages/db/src/schema.ts`:

```bash
pnpm --filter @ferrocms/db db:generate   # after editing schema.ts — writes a new numbered migration
pnpm --filter @ferrocms/db db:migrate    # apply pending migrations to DATABASE_URL
pnpm --filter @ferrocms/db db:push       # dev convenience: push schema.ts directly, no migration file
```

Use `db:push` for local iteration; use `db:generate` + `db:migrate` for anything you intend to apply to
a shared/production database, so the change is reviewable and reversible. Migrations are additive by
default (new tables/columns) — always review a generated migration before running it against real data,
and take a Turso database snapshot/branch first if the change touches existing columns.

## Upgrading your fork or deployment

1. `git pull` (or merge upstream if you've forked) and `pnpm install`.
2. Check `packages/db/migrations/` for new files since your last pull and run
   `pnpm --filter @ferrocms/db db:migrate` against your database.
3. Re-run `pnpm build && pnpm typecheck` — a config-as-code break (e.g. a renamed field on
   `CollectionConfig`) surfaces as a TypeScript error in your `collections.ts`, not a silent runtime
   failure.
4. Check the commit log for changes under `packages/core/src/` — that package defines the
   `defineCollection`/`defineGlobal`/`defineForm`/field-type contracts your config relies on.

## Compatibility notes

- **SDK packaging:** `@ferrocms/sdk` ships built `dist/` output (not raw TypeScript) specifically so it
  resolves correctly under any bundler, including webpack/Next.js. If you vendor the SDK directly
  instead of installing it, build it first (`pnpm --filter @ferrocms/sdk build`).
- **Reserved field names:** `id`, `status`, `createdAt`, `updatedAt`, `publishedAt` are reserved at the
  top level of any collection/global — `defineCollection`/`defineGlobal` throw at startup if you declare
  one, since they're real columns, not JSON-data fields.
- **Locales:** removing a locale from a collection's `locales` array does not delete the stored
  per-locale data for existing entries — it just stops being offered in the admin's locale tabs.

## Known limitations (pre-1.0)

- No plugin marketplace or `npm install`-and-auto-discover — plugins are imported manually (see
  [Plugin authoring](/plugins)).
- No SSO/OAuth, drag-and-drop page builder, or real-time collaborative editing yet.
- No automated schema-diff warning when a config change would be destructive — review generated
  migrations manually.

Found a breaking change that isn't documented here? Open an issue — upgrade friction is exactly the
kind of feedback that shapes what stabilizes before 1.0.
